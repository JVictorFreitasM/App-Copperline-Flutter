import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Reserva presa em PROCESSANDO por mais tempo que isso e' considerada
// abandonada (processo caiu no meio da execucao) e pode ser retomada - sem
// isso, um crash deixaria a acao travada pra sempre.
const VALIDADE_RESERVA_MS = 5 * 60 * 1000;

export type TipoAcaoIdempotente =
  | 'CRIAR_PEDIDO'
  | 'CHECKIN_VISITA'
  | 'CHECKOUT_VISITA'
  | 'CANCELAR_VISITA'
  | 'RASTREIO_LOTE';

export type ReservaAcao =
  // Este chamador ganhou a reserva e DEVE executar a acao e chamar concluir().
  | { situacao: 'nova'; registroId: string }
  // Outra requisicao (mesmo usuarioId+idLocal) esta executando agora.
  | { situacao: 'em-processamento' }
  // Mesmo idLocal ja usado com conteudo diferente.
  | { situacao: 'conflito' }
  // Ja executada antes - devolve o resultado congelado, nunca re-executa.
  | {
      situacao: 'concluida';
      status: 'SUCESSO' | 'ERRO';
      resultado?: unknown;
      erro?: string;
      payloadHash: string | null;
    };

function violouUnicidade(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

// Idempotencia por (usuarioId, idLocal) com RESERVA ANTES de executar: a
// constraint unica do banco e' a trava, entao so uma de N requisicoes
// concorrentes com o mesmo idLocal executa a acao (antes, o registro so era
// criado depois de executar - duas requisicoes simultaneas passavam pela
// checagem e ambas criavam o pedido). Usado pela fila offline do app e pelo
// POST /pedidos direto.
@Injectable()
export class IdempotenciaAcaoService {
  constructor(private readonly prisma: PrismaService) {}

  async reservar(
    usuarioId: string,
    idLocal: string,
    tipo: TipoAcaoIdempotente,
    payloadHash: string | null,
  ): Promise<ReservaAcao> {
    try {
      const criado = await this.prisma.acaoFilaProcessada.create({
        data: { usuarioId, idLocal, tipo, status: 'PROCESSANDO', payloadHash },
      });
      return { situacao: 'nova', registroId: criado.id };
    } catch (error) {
      if (!violouUnicidade(error)) {
        throw error;
      }
    }

    const existente = await this.prisma.acaoFilaProcessada.findUnique({
      where: { usuarioId_idLocal: { usuarioId, idLocal } },
    });
    if (!existente) {
      throw new Error(`Reserva da ação '${idLocal}' sumiu durante a disputa`);
    }

    // So compara hash quando os dois lados tem um - o POST /pedidos direto
    // reserva sem hash (nao ha comprovante de fila nele), e o reenvio pela
    // fila do MESMO idLocal precisa reconhecer esse pedido, nao dar conflito.
    if (payloadHash && existente.payloadHash && existente.payloadHash !== payloadHash) {
      return { situacao: 'conflito' };
    }

    if (existente.status === 'PROCESSANDO') {
      const retomada = await this.prisma.acaoFilaProcessada.updateMany({
        where: {
          id: existente.id,
          status: 'PROCESSANDO',
          processadoEm: { lt: new Date(Date.now() - VALIDADE_RESERVA_MS) },
        },
        data: { processadoEm: new Date() },
      });
      return retomada.count === 1
        ? { situacao: 'nova', registroId: existente.id }
        : { situacao: 'em-processamento' };
    }

    return {
      situacao: 'concluida',
      status: existente.status === 'SUCESSO' ? 'SUCESSO' : 'ERRO',
      resultado: existente.resultado ?? undefined,
      erro: existente.erro ?? undefined,
      payloadHash: existente.payloadHash,
    };
  }

  async concluir(
    registroId: string,
    status: 'SUCESSO' | 'ERRO',
    resultado?: unknown,
    erro?: string,
  ): Promise<void> {
    await this.prisma.acaoFilaProcessada.update({
      where: { id: registroId },
      data: {
        status,
        resultado: resultado as Prisma.InputJsonValue | undefined,
        erro,
        processadoEm: new Date(),
      },
    });
  }
}
