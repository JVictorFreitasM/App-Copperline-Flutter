import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { IdpUser } from '@copperline/idp-client';
import { IdempotenciaAcaoService } from '../idempotencia-acao/idempotencia-acao.service';
import { ConfiguracaoFuncionalidadesService } from '../configuracoes/configuracao-funcionalidades.service';
import { CriarPedidoService } from '../pedidos/criar-pedido.service';
import { RastreioService } from '../rastreio/rastreio.service';
import { VendedorEscopoService } from '../vendedores/vendedor-escopo.service';
import { VisitasService } from '../visitas/visitas.service';
import type { AcaoFilaDto, ResultadoAcaoFilaDto } from './dto/fila-pendente.dto';
import { comprovanteDaAcao } from './hash-acao';
import type { ComprovanteAcao } from './hash-acao';
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
    private readonly idempotencia: IdempotenciaAcaoService,
    private readonly criarPedidoService: CriarPedidoService,
    private readonly visitasService: VisitasService,
    private readonly rastreioService: RastreioService,
    private readonly vendedorEscopoService: VendedorEscopoService,
    private readonly funcionalidades: ConfiguracaoFuncionalidadesService,
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
    const comprovante = comprovanteDaAcao(acao);

    // Integridade (ack): o app mandou o hash do que ENVIOU; se o que chegou
    // gera outro hash, o corpo foi truncado/corrompido - nada e' processado
    // nem registrado (o reenvio com o conteudo certo precisa poder rodar).
    if (acao.hash && acao.hash !== comprovante.hash) {
      return {
        idLocal: acao.idLocal,
        status: 'ERRO',
        erro: 'Integridade: o conteúdo recebido difere do enviado - reenvie a ação',
        ack: comprovante,
      };
    }

    // Envio de pedidos desativado (Configuracoes > Funcionalidades): pedido que
    // iria ao ERP fica RETIDO na fila do aparelho (PROCESSANDO = o app mantem
    // PENDENTE e reenvia depois). Nao reserva o idLocal: ao religar, executa
    // normalmente, sem ter virado ERRO congelado. Orcamento passa direto.
    if (acao.tipo === 'CRIAR_PEDIDO' && acao.payload.salvarComoOrcamento !== true) {
      const { envioPedidosHabilitado } = await this.funcionalidades.obter();
      if (!envioPedidosHabilitado) {
        return { idLocal: acao.idLocal, status: 'PROCESSANDO', ack: comprovante };
      }
    }

    // Reserva o idLocal ANTES de executar (a constraint unica do banco e' a
    // trava): requisicoes concorrentes com o mesmo idLocal - sincronizacao
    // disparada por mais de um gatilho no app - nunca executam a acao duas
    // vezes. Ver IdempotenciaAcaoService.
    const reserva = await this.idempotencia.reservar(
      usuarioId,
      acao.idLocal,
      acao.tipo,
      comprovante.hash,
    );

    switch (reserva.situacao) {
      case 'conflito':
        // Mesmo idLocal com conteudo DIFERENTE do que foi processado: nao e'
        // reenvio, e' conflito - nunca devolve sucesso de outra acao.
        return {
          idLocal: acao.idLocal,
          status: 'ERRO',
          erro: 'Conflito: este idLocal já foi processado com conteúdo diferente',
          ack: comprovante,
        };
      case 'em-processamento':
        // Outra requisicao esta executando esta mesma acao agora - o app
        // mantem PENDENTE e reenvia depois (recebe o resultado congelado).
        return { idLocal: acao.idLocal, status: 'PROCESSANDO', ack: comprovante };
      case 'concluida':
        // Reenvio (retry de rede no meio do envio anterior) - devolve o
        // resultado JA CONGELADO, nunca re-executa.
        return {
          idLocal: acao.idLocal,
          status: reserva.status,
          resultado: reserva.resultado,
          erro: reserva.erro,
          ack: { hash: reserva.payloadHash ?? comprovante.hash, bytes: comprovante.bytes },
        };
      case 'nova':
        break;
    }

    let resultado: unknown;
    try {
      resultado = await this.executar(usuarioId, idpUser, acao);
    } catch (error) {
      const mensagem = extrairMensagemErro(error);
      await this.idempotencia.concluir(reserva.registroId, 'ERRO', undefined, mensagem);
      return { idLocal: acao.idLocal, status: 'ERRO', erro: mensagem, ack: comprovante };
    }
    // Fora do try de proposito: a acao JA foi executada - falha ao gravar o
    // resultado nao pode virar ERRO de uma acao que deu certo.
    await this.idempotencia.concluir(reserva.registroId, 'SUCESSO', resultado);
    return { idLocal: acao.idLocal, status: 'SUCESSO', resultado, ack: comprovante };
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
