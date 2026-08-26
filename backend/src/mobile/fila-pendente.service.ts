import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { IdpUser } from '@copperline/idp-client';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CriarPedidoService } from '../pedidos/criar-pedido.service';
import { RastreioService } from '../rastreio/rastreio.service';
import { VendedorEscopoService } from '../vendedores/vendedor-escopo.service';
import { VisitasService } from '../visitas/visitas.service';
import type { AcaoFilaDto, ResultadoAcaoFilaDto } from './dto/fila-pendente.dto';
import {
  CancelarVisitaOfflineDto,
  CheckinVisitaOfflineDto,
  CheckoutVisitaOfflineDto,
  CriarPedidoOfflineDto,
  RastreioLoteOfflineDto,
} from './dto/payloads-acao-fila.dto';

// Fila de acoes offline (OS-BACKEND-29) - NUNCA reimplementa a regra de
// negocio de pedido/visita/rastreio, so orquestra: valida o payload contra
// o DTO ja existente de cada acao, chama o service ja existente, e
// resolve idempotencia (ver processarUma). "Processa cada uma na ordem"
// (criterio da OS) - for sequencial de proposito, nao Promise.all
// (ex: check-in seguido de checkout da MESMA visita no mesmo lote precisa
// rodar em ordem).
@Injectable()
export class FilaPendenteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly criarPedidoService: CriarPedidoService,
    private readonly visitasService: VisitasService,
    private readonly rastreioService: RastreioService,
    private readonly vendedorEscopoService: VendedorEscopoService,
  ) {}

  async processar(
    usuarioId: string,
    idpUser: IdpUser,
    acoes: AcaoFilaDto[],
  ): Promise<ResultadoAcaoFilaDto[]> {
    const resultados: ResultadoAcaoFilaDto[] = [];
    for (const acao of acoes) {
      resultados.push(await this.processarUma(usuarioId, idpUser, acao));
    }
    return resultados;
  }

  private async processarUma(
    usuarioId: string,
    idpUser: IdpUser,
    acao: AcaoFilaDto,
  ): Promise<ResultadoAcaoFilaDto> {
    const existente = await this.prisma.acaoFilaProcessada.findUnique({
      where: { usuarioId_idLocal: { usuarioId, idLocal: acao.idLocal } },
    });
    if (existente) {
      // Reenvio (retry de rede no meio do envio anterior, criterio de
      // aceite) - devolve o resultado JA CONGELADO, nunca re-executa.
      return {
        idLocal: acao.idLocal,
        status: existente.status,
        resultado: existente.resultado ?? undefined,
        erro: existente.erro ?? undefined,
      };
    }

    try {
      const resultado = await this.executar(usuarioId, idpUser, acao);
      return await this.registrarResultado(usuarioId, acao, 'SUCESSO', resultado);
    } catch (error) {
      const mensagem = extrairMensagemErro(error);
      return await this.registrarResultado(usuarioId, acao, 'ERRO', undefined, mensagem);
    }
  }

  // Cria o registro de idempotencia so DEPOIS de executar - se duas
  // chamadas concorrentes (mesmo idLocal) escaparem da checagem acima
  // (corrida rara), a constraint @@unique([usuarioId, idLocal]) do banco
  // rejeita a segunda gravacao (P2002); nesse caso busca o que a primeira
  // ja gravou em vez de estourar erro pro app.
  private async registrarResultado(
    usuarioId: string,
    acao: AcaoFilaDto,
    status: 'SUCESSO' | 'ERRO',
    resultado?: unknown,
    erro?: string,
  ): Promise<ResultadoAcaoFilaDto> {
    try {
      await this.prisma.acaoFilaProcessada.create({
        data: {
          usuarioId,
          idLocal: acao.idLocal,
          tipo: acao.tipo,
          status,
          resultado: resultado as Prisma.InputJsonValue,
          erro,
        },
      });
      return { idLocal: acao.idLocal, status, resultado, erro };
    } catch {
      const jaGravado = await this.prisma.acaoFilaProcessada.findUnique({
        where: { usuarioId_idLocal: { usuarioId, idLocal: acao.idLocal } },
      });
      if (jaGravado) {
        return {
          idLocal: acao.idLocal,
          status: jaGravado.status,
          resultado: jaGravado.resultado ?? undefined,
          erro: jaGravado.erro ?? undefined,
        };
      }
      throw new Error(`Falha ao registrar resultado da ação '${acao.idLocal}'`);
    }
  }

  private async executar(
    usuarioId: string,
    idpUser: IdpUser,
    acao: AcaoFilaDto,
  ): Promise<unknown> {
    const momento = new Date(acao.timestamp);

    switch (acao.tipo) {
      case 'CRIAR_PEDIDO': {
        const dto = await validarPayload(CriarPedidoOfflineDto, acao.payload);
        const escopo = await this.vendedorEscopoService.resolverEscopoClientes(
          idpUser,
          usuarioId,
        );
        return this.criarPedidoService.criar(dto, usuarioId, escopo);
      }
      case 'CHECKIN_VISITA': {
        const dto = await validarPayload(CheckinVisitaOfflineDto, acao.payload);
        const fotoBuffer = Buffer.from(dto.foto, 'base64');
        return this.visitasService.checkin(
          usuarioId,
          { clienteId: dto.clienteId, latitude: dto.latitude, longitude: dto.longitude, nota: dto.nota },
          fotoBuffer,
          momento,
        );
      }
      case 'CHECKOUT_VISITA': {
        const dto = await validarPayload(CheckoutVisitaOfflineDto, acao.payload);
        return this.visitasService.checkout(
          usuarioId,
          dto.visitaId,
          { latitude: dto.latitude, longitude: dto.longitude, nota: dto.nota },
          momento,
        );
      }
      case 'CANCELAR_VISITA': {
        const dto = await validarPayload(CancelarVisitaOfflineDto, acao.payload);
        return this.visitasService.cancelar(usuarioId, dto.visitaId, dto.comentario, momento);
      }
      case 'RASTREIO_LOTE': {
        const dto = await validarPayload(RastreioLoteOfflineDto, acao.payload);
        return this.rastreioService.registrarLote(usuarioId, dto.pontos);
      }
    }
  }
}

async function validarPayload<T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
): Promise<T> {
  const instancia = plainToInstance(cls, payload);
  const erros = await validate(instancia as object, { whitelist: true });
  if (erros.length > 0) {
    const mensagens = erros.flatMap((erro) => Object.values(erro.constraints ?? {}));
    throw new BadRequestException(`Payload inválido: ${mensagens.join('; ')}`);
  }
  return instancia;
}

function extrairMensagemErro(error: unknown): string {
  if (error instanceof HttpException) {
    const resposta = error.getResponse();
    if (typeof resposta === 'string') return resposta;
    if (typeof resposta === 'object' && resposta !== null && 'message' in resposta) {
      const mensagem = (resposta as { message: unknown }).message;
      return Array.isArray(mensagem) ? mensagem.join('; ') : String(mensagem);
    }
  }
  return error instanceof Error ? error.message : String(error);
}
