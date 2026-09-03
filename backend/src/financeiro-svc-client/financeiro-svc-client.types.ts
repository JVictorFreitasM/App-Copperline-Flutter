// Subconjunto de PosicaoFinanceira (WSDL de Financeiro.svc,
// BuscarPosicaoFinanceira) - so os campos que ClienteFinanceiroService
// (OS-BACKEND-36) expõe em GET /clientes/:id/financeiro. O ERP ja entrega o
// perfil de credito calculado (nao e' necessario somar titulo por titulo -
// decisao confirmada, ver comentario em cliente-financeiro.service.ts).
export interface PosicaoFinanceiraBruta {
  ValorLimite: number;
  ValorLimiteSerasa: number;
  ValorCreditoDisponivel: number;
  ValorCreditoUtilizado: number;
  ValorSaldoAVencer: number;
  ValorSaldoVencido: number;
  ValorMaiorAtraso: number;
  MediaAtraso: number;
  QtdeBaixasPorInadimplencia: number;
  ValorTotalDeCompras: number;
  DataUltimaFatura: string | null;
  VendaBloqueada: boolean;
}
