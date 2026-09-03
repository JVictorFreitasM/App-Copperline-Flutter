import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  construirWhereClientePorEscopo,
  type EscopoClientes,
} from '../vendedores/vendedor-escopo.service';

export type TimelineEvento =
  | { tipo: 'PEDIDO'; data: string; pedidoId: string; numero: string | null; situacao: string | null; valorTotal: string | null }
  | {
      tipo: 'PEDIDO_STATUS_ALTERADO';
      data: string;
      pedidoId: string;
      statusAnterior: string | null;
      statusNovo: string;
    }
  | { tipo: 'VISITA_CHECKIN'; data: string; visitaId: string }
  | { tipo: 'VISITA_CHECKOUT'; data: string; visitaId: string }
  | { tipo: 'VISITA_CANCELADA'; data: string; visitaId: string; motivo: string | null }
  | {
      tipo: 'NOTA_FISCAL';
      data: string;
      notaFiscalId: string;
      numero: number | null;
      status: string | null;
    };

// GET /clientes/:id/timeline (OS-WEB-42/OS-MOBILE-40) - combina Pedido
// (estado atual + mudancas de status via PedidoHistoricoStatus,
// OS-BACKEND-33), Visita (checkin/checkout/cancelamento) e notas fiscais
// relacionadas, ordenados cronologicamente (mais recente primeiro) - so'
// dado ja sincronizado/persistido, nenhum evento sintetico "inventado"
// (ex: nao ha "pedido criado" pra pedido vindo de sync do ERP, so' o
// estado atual dele, ja que a sincronizacao nao registra uma data de
// criacao propria distinta de dataHoraUltimaAlteracao).
@Injectable()
export class ClienteTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async obterTimeline(
    clienteId: string,
    escopo: EscopoClientes,
  ): Promise<TimelineEvento[]> {
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

    const [pedidos, historicoStatus, visitas, notasFiscais] = await Promise.all([
      this.prisma.pedido.findMany({
        where: { clienteId },
        select: {
          id: true,
          numero: true,
          situacao: true,
          valorTotal: true,
          dataHoraUltimaAlteracao: true,
        },
      }),
      this.prisma.pedidoHistoricoStatus.findMany({
        where: { pedido: { clienteId } },
        select: { pedidoId: true, statusAnterior: true, statusNovo: true, alteradoEm: true },
      }),
      this.prisma.visita.findMany({
        where: { clienteId },
        select: {
          id: true,
          checkinEm: true,
          checkoutEm: true,
          canceladaEm: true,
          motivoCancelamento: true,
        },
      }),
      this.prisma.notaFiscal.findMany({
        where: { pedidos: { some: { pedido: { clienteId } } } },
        select: { id: true, numero: true, statusNfe: true, dataEmissao: true },
      }),
    ]);

    const eventos: TimelineEvento[] = [];

    for (const pedido of pedidos) {
      if (!pedido.dataHoraUltimaAlteracao) continue;
      eventos.push({
        tipo: 'PEDIDO',
        data: pedido.dataHoraUltimaAlteracao.toISOString(),
        pedidoId: pedido.id,
        numero: pedido.numero,
        situacao: pedido.situacao,
        valorTotal: pedido.valorTotal?.toString() ?? null,
      });
    }

    for (const transicao of historicoStatus) {
      eventos.push({
        tipo: 'PEDIDO_STATUS_ALTERADO',
        data: transicao.alteradoEm.toISOString(),
        pedidoId: transicao.pedidoId,
        statusAnterior: transicao.statusAnterior,
        statusNovo: transicao.statusNovo,
      });
    }

    for (const visita of visitas) {
      eventos.push({
        tipo: 'VISITA_CHECKIN',
        data: visita.checkinEm.toISOString(),
        visitaId: visita.id,
      });
      if (visita.checkoutEm) {
        eventos.push({
          tipo: 'VISITA_CHECKOUT',
          data: visita.checkoutEm.toISOString(),
          visitaId: visita.id,
        });
      }
      if (visita.canceladaEm) {
        eventos.push({
          tipo: 'VISITA_CANCELADA',
          data: visita.canceladaEm.toISOString(),
          visitaId: visita.id,
          motivo: visita.motivoCancelamento,
        });
      }
    }

    for (const nota of notasFiscais) {
      if (!nota.dataEmissao) continue;
      eventos.push({
        tipo: 'NOTA_FISCAL',
        data: nota.dataEmissao.toISOString(),
        notaFiscalId: nota.id,
        numero: nota.numero,
        status: nota.statusNfe,
      });
    }

    return eventos.sort((a, b) => b.data.localeCompare(a.data));
  }
}
