// Subconjunto do ReadFormaPagamentoDto (Radar.API, GET
// /empresarial/v1/forma-pagamento) que o sistema efetivamente usa - schema
// completo confirmado contra o endpoint real (ver OS-pendentes-claude-code.md,
// secao "Envio de pedido ao ERP"). MeioPagamento (enum bruto: Dinheiro,
// CartaoCredito, Pix etc.) fica fora - `descricao` ja e' o texto pronto pra
// exibir num seletor, sem precisar traduzir o enum.
export interface WkRadarFormaPagamento {
  id: string;
  codigoIntegrador?: string | null;
  codigo?: string | null;
  descricao?: string | null;
  inativa: boolean;
}

export interface FormaPagamentoMapeada {
  idExternoErp: string;
  codigo: string | null;
  descricao: string | null;
  inativa: boolean;
}
