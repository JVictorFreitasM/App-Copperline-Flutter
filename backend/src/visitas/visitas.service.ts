import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import exifr from 'exifr';
import { PrismaService } from '../prisma/prisma.service';
import {
  construirWhereClientePorEscopo,
  type EscopoClientes,
} from '../vendedores/vendedor-escopo.service';
import { calcularDistanciaMetros } from './domain/distancia-geografica';
import {
  FotoDataHoraDivergenteError,
  FotoSemExifDataHoraError,
  validarExifDataHora,
} from './domain/validar-exif-foto';
import { paraVisitaDto, type VisitaDto } from './dto/visita-response.dto';
import { registrarEventoNotificacao } from '../notificacoes/evento-notificacao.service';
import { VisitaFotoStorageService } from './visita-foto-storage.service';

export interface CheckinInput {
  clienteId: string;
  latitude: number;
  longitude: number;
  nota?: string;
}

export interface CheckoutInput {
  latitude: number;
  longitude: number;
  nota?: string;
}

// Raio maximo aceito entre a posicao do vendedor (check-in/checkout) e o
// pin do cliente (Cliente.localizacaoLat/Lng) - extensao pos-OS-BACKEND-28,
// decisao do usuario ("ate 50m de distancia do pin").
const RAIO_MAXIMO_METROS = 50;

// Evento deliberado do vendedor - a unica regra de negocio com multiplos
// cenarios de verdade e' a validacao de distancia/foto no check-in (ver
// domain/distancia-geografica.ts e domain/validar-exif-foto.ts, ja
// isoladas la); o resto e' transporte, sem entidade de dominio propria
// maior (ver skill nest-endpoint, criterio de DDD).
@Injectable()
export class VisitasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fotoStorageService: VisitaFotoStorageService,
  ) {}

  async checkin(
    usuarioId: string,
    input: CheckinInput,
    fotoBuffer: Buffer,
  ): Promise<VisitaDto> {
    const vendedor = await this.resolverVendedor(usuarioId);

    // Check-in so pode ser feito num cliente que o PROPRIO vendedor atende
    // (nao a equipe inteira, mesmo que ele seja supervisor/gerente) -
    // visita e' um evento de campo individual, diferente do escopo de
    // LEITURA usado em GET /clientes (VendedorEscopoService), onde
    // supervisor/gerente veem a carteira da equipe inteira.
    const cliente = await this.prisma.cliente.findFirst({
      where: {
        id: input.clienteId,
        vendedores: { some: { vendedorId: vendedor.id } },
      },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente '${input.clienteId}' não encontrado`);
    }

    if (cliente.localizacaoLat === null || cliente.localizacaoLng === null) {
      throw new UnprocessableEntityException(
        `Cliente '${input.clienteId}' sem localização (pin) definida - defina via PATCH /clientes/${input.clienteId}/localizacao antes de fazer check-in`,
      );
    }

    const distanciaMetros = calcularDistanciaMetros(
      input.latitude,
      input.longitude,
      cliente.localizacaoLat.toNumber(),
      cliente.localizacaoLng.toNumber(),
    );
    if (distanciaMetros > RAIO_MAXIMO_METROS) {
      throw new BadRequestException(
        `Check-in a ${Math.round(distanciaMetros)}m do cliente - fora do raio máximo de ${RAIO_MAXIMO_METROS}m`,
      );
    }

    // Um vendedor so pode ter UMA visita aberta por vez (criterio de
    // aceite, decisao confirmada com o usuario) - bloqueia com erro claro
    // em vez de fechar a anterior sozinho. "Aberta" exclui cancelada (ver
    // cancelar()) - visita cancelada nunca teve checkout, mas nao conta
    // como bloqueio pra um novo check-in.
    const visitaAberta = await this.prisma.visita.findFirst({
      where: { vendedorId: vendedor.id, checkoutEm: null, canceladaEm: null },
      select: { id: true, clienteId: true },
    });
    if (visitaAberta) {
      throw new ConflictException(
        `Já existe uma visita em aberto (id '${visitaAberta.id}', cliente '${visitaAberta.clienteId}') - faça checkout ou cancele antes de iniciar outra`,
      );
    }

    const checkinEm = new Date();
    await this.validarFotoOuFalhar(fotoBuffer, checkinEm);
    const fotoCaminho = await this.fotoStorageService.salvar(fotoBuffer);

    const visita = await this.prisma.visita.create({
      data: {
        clienteId: input.clienteId,
        vendedorId: vendedor.id,
        checkinEm,
        checkinLat: input.latitude,
        checkinLng: input.longitude,
        nota: input.nota,
        fotoCheckinCaminho: fotoCaminho,
        distanciaCheckinMetros: distanciaMetros,
      },
    });

    return paraVisitaDto(visita);
  }

  async checkout(
    usuarioId: string,
    visitaId: string,
    input: CheckoutInput,
  ): Promise<VisitaDto> {
    const vendedor = await this.resolverVendedor(usuarioId);

    // 404 (nao 403) pra visita de outro vendedor - mesmo criterio de IDOR
    // ja usado em cliente (ver skill security-review): nao confirma
    // existencia pra quem nao deveria mexer.
    const visita = await this.prisma.visita.findFirst({
      where: { id: visitaId, vendedorId: vendedor.id },
      include: { cliente: { select: { localizacaoLat: true, localizacaoLng: true } } },
    });
    if (!visita) {
      throw new NotFoundException(`Visita '${visitaId}' não encontrada`);
    }

    if (visita.canceladaEm) {
      throw new ConflictException(`Visita '${visitaId}' foi cancelada`);
    }
    if (visita.checkoutEm) {
      throw new ConflictException(`Visita '${visitaId}' já teve checkout`);
    }

    // Pin so poderia faltar aqui se alguem apagasse manualmente depois do
    // check-in (o check-in ja exige pin) - checagem defensiva, nao um
    // caminho esperado.
    if (visita.cliente.localizacaoLat === null || visita.cliente.localizacaoLng === null) {
      throw new UnprocessableEntityException(
        `Cliente '${visita.clienteId}' sem localização (pin) definida`,
      );
    }

    const distanciaMetros = calcularDistanciaMetros(
      input.latitude,
      input.longitude,
      visita.cliente.localizacaoLat.toNumber(),
      visita.cliente.localizacaoLng.toNumber(),
    );
    if (distanciaMetros > RAIO_MAXIMO_METROS) {
      throw new BadRequestException(
        `Checkout a ${Math.round(distanciaMetros)}m do cliente - fora do raio máximo de ${RAIO_MAXIMO_METROS}m`,
      );
    }

    const atualizada = await this.prisma.visita.update({
      where: { id: visitaId },
      data: {
        checkoutEm: new Date(),
        checkoutLat: input.latitude,
        checkoutLng: input.longitude,
        distanciaCheckoutMetros: distanciaMetros,
        // So sobrescreve a nota se uma nova vier - checkout sem nota
        // preserva o que foi escrito no checkin.
        ...(input.nota !== undefined && { nota: input.nota }),
      },
    });

    return paraVisitaDto(atualizada);
  }

  // Vendedor errou o cliente - cancela ANTES do checkout, com comentario
  // obrigatorio repassado ao supervisor DIRETO via push (extensao
  // pos-OS-BACKEND-28, decisao confirmada com o usuario). Registra o
  // EventoNotificacao na MESMA transacao da mudanca de estado, mesmo
  // padrao ja usado nas strategies de sync (ver evento-notificacao.service.ts)
  // - o evento so existe se o cancelamento em si tiver sucesso.
  async cancelar(
    usuarioId: string,
    visitaId: string,
    comentario: string,
  ): Promise<VisitaDto> {
    const vendedor = await this.resolverVendedor(usuarioId);

    const visita = await this.prisma.visita.findFirst({
      where: { id: visitaId, vendedorId: vendedor.id },
    });
    if (!visita) {
      throw new NotFoundException(`Visita '${visitaId}' não encontrada`);
    }
    if (visita.canceladaEm) {
      throw new ConflictException(`Visita '${visitaId}' já foi cancelada`);
    }
    if (visita.checkoutEm) {
      throw new ConflictException(
        `Visita '${visitaId}' já teve checkout - não é mais possível cancelar`,
      );
    }

    const atualizada = await this.prisma.$transaction(async (tx) => {
      const resultado = await tx.visita.update({
        where: { id: visitaId },
        data: { canceladaEm: new Date(), motivoCancelamento: comentario },
      });

      await registrarEventoNotificacao(tx, {
        tipo: 'VISITA_CANCELADA',
        referenciaId: visitaId,
        titulo: 'Check-in de visita cancelado',
        corpo: `${vendedor.nome ?? 'Um vendedor'} cancelou um check-in: ${comentario}`,
        dados: { visitaId, vendedorId: vendedor.id },
      });

      return resultado;
    });

    return paraVisitaDto(atualizada);
  }

  async listarPorCliente(
    clienteId: string,
    escopo: EscopoClientes,
  ): Promise<VisitaDto[]> {
    const whereEscopo = construirWhereClientePorEscopo(escopo);
    if (whereEscopo === null) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }

    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, ...whereEscopo },
      select: { id: true },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }

    const visitas = await this.prisma.visita.findMany({
      where: { clienteId },
      orderBy: { checkinEm: 'desc' },
    });

    return visitas.map(paraVisitaDto);
  }

  async obterCaminhoFoto(visitaId: string): Promise<string> {
    const visita = await this.prisma.visita.findUnique({
      where: { id: visitaId },
      select: { fotoCheckinCaminho: true },
    });
    if (!visita?.fotoCheckinCaminho) {
      throw new NotFoundException(`Foto da visita '${visitaId}' não encontrada`);
    }
    return visita.fotoCheckinCaminho;
  }

  private async validarFotoOuFalhar(
    fotoBuffer: Buffer,
    checkinEm: Date,
  ): Promise<void> {
    if (!fotoBuffer || fotoBuffer.length === 0) {
      throw new BadRequestException('Foto da fachada é obrigatória para o check-in');
    }

    // EXIF pode ser forjado por quem realmente quiser - isso dificulta o
    // uso casual de foto antiga/da galeria, nao e' uma garantia
    // criptografica (ver domain/validar-exif-foto.ts).
    const exif = await exifr.parse(fotoBuffer, {
      pick: ['DateTimeOriginal', 'CreateDate'],
    });

    try {
      validarExifDataHora(exif, checkinEm);
    } catch (error) {
      if (
        error instanceof FotoSemExifDataHoraError ||
        error instanceof FotoDataHoraDivergenteError
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async resolverVendedor(usuarioId: string) {
    const vendedor = await this.prisma.vendedor.findFirst({
      where: { usuarioId },
    });
    if (!vendedor) {
      throw new ForbiddenException(
        'Usuário autenticado não é um vendedor cadastrado - não pode registrar visita',
      );
    }
    return vendedor;
  }
}
