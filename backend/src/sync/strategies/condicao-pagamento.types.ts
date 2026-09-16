// Subconjunto do ReadCondicaoPagamentoDto (Radar.API, GET
// /empresarial/v1/condicao-pagamento) que o sistema efetivamente usa -
// schema completo confirmado contra o endpoint real (ver
// OS-pendentes-claude-code.md, secao "Envio de pedido ao ERP"). Parcela nao
// tem id proprio - so o array de percentual/prazo/idTipoVencimento, mesmo
// criterio de "sem identidade propria" ja usado em Cliente.enderecos.
export interface WkRadarParcelaCondicaoPagamento {
  percentual: number;
  prazo: number;
  idTipoVencimento?: string | null;
}

export interface WkRadarCondicaoPagamento {
  id: string;
  codigoIntegrador?: string | null;
  codigo?: string | null;
  nome?: string | null;
  aVista: boolean;
  comEntrada: boolean;
  antecipada: boolean;
  // Formato "DD/MM/AAAA" (sem hora, diferente de dataHoraUltimaAlteracao
  // em outros recursos) - null quando a condicao nao tem data de
  // expiracao (sempre valida).
  validade?: string | null;
  parcelas?: WkRadarParcelaCondicaoPagamento[] | null;
}

export interface CondicaoPagamentoMapeada {
  idExternoErp: string;
  codigo: string | null;
  nome: string | null;
  aVista: boolean;
  comEntrada: boolean;
  antecipada: boolean;
  validade: Date | null;
  parcelas: WkRadarParcelaCondicaoPagamento[];
}
