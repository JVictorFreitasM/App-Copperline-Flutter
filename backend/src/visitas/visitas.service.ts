import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  construirWhereClientePorEscopo,
  type EscopoClientes,
} from '../vendedores/vendedor-escopo.service';
import { paraVisitaDto, type VisitaDto } from './dto/visita-response.dto';

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

// Evento deliberado do vendedor - sem regra de negocio com multiplos
// cenarios alem do bloqueio de visita dupla (checkin) - transporte simples,
// sem entidade de dominio separada (ver skill nest-endpoint, criterio de
// DDD).
@Injectable()
export class VisitasService {
  constructor(private readonly prisma: PrismaService) {}

  async checkin(usuarioId: string, input: CheckinInput): Promise<VisitaDto> {
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

    // Um vendedor so pode ter UMA visita aberta por vez (criterio de
    // aceite, decisao confirmada com o usuario) - bloqueia com erro claro
    // em vez de fechar a anterior sozinho.
    const visitaAberta = await this.prisma.visita.findFirst({
      where: { vendedorId: vendedor.id, checkoutEm: null },
      select: { id: true, clienteId: true },
    });
    if (visitaAberta) {
      throw new ConflictException(
        `Já existe uma visita em aberto (id '${visitaAberta.id}', cliente '${visitaAberta.clienteId}') - faça checkout antes de iniciar outra`,
      );
    }

    const visita = await this.prisma.visita.create({
      data: {
        clienteId: input.clienteId,
        vendedorId: vendedor.id,
        checkinEm: new Date(),
        checkinLat: input.latitude,
        checkinLng: input.longitude,
        nota: input.nota,
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
    });
    if (!visita) {
      throw new NotFoundException(`Visita '${visitaId}' não encontrada`);
    }

    if (visita.checkoutEm) {
      throw new ConflictException(`Visita '${visitaId}' já teve checkout`);
    }

    const atualizada = await this.prisma.visita.update({
      where: { id: visitaId },
      data: {
        checkoutEm: new Date(),
        checkoutLat: input.latitude,
        checkoutLng: input.longitude,
        // So sobrescreve a nota se uma nova vier - checkout sem nota
        // preserva o que foi escrito no checkin.
        ...(input.nota !== undefined && { nota: input.nota }),
      },
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
