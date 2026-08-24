export interface ContagemPorSituacaoDto {
  situacao: string | null;
  quantidade: number;
}

export interface VendasDashboardDto {
  periodo: { dataInicial: string | null; dataFinal: string | null };
  totalPedidos: number;
  valorTotal: string;
  // "0" quando totalPedidos === 0 (nunca divide por zero).
  ticketMedio: string;
  contagemPorSituacao: ContagemPorSituacaoDto[];
}
