// Mesmo shape de backend/src/clientes/cliente-timeline.service.ts
// (TimelineEvento, GET /clientes/:id/timeline, OS-WEB-42/OS-MOBILE-40) -
// discriminado por `tipo`, ordenado do mais recente pro mais antigo.
export type TimelineEvento =
  | {
      tipo: "PEDIDO";
      data: string;
      pedidoId: string;
      numero: string | null;
      situacao: string | null;
      valorTotal: string | null;
    }
  | {
      tipo: "PEDIDO_STATUS_ALTERADO";
      data: string;
      pedidoId: string;
      statusAnterior: string | null;
      statusNovo: string;
    }
  | { tipo: "VISITA_CHECKIN"; data: string; visitaId: string }
  | { tipo: "VISITA_CHECKOUT"; data: string; visitaId: string }
  | { tipo: "VISITA_CANCELADA"; data: string; visitaId: string; motivo: string | null }
  | {
      tipo: "NOTA_FISCAL";
      data: string;
      notaFiscalId: string;
      numero: number | null;
      status: string | null;
    };
