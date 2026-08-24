export interface ContagemPorStatusNfeDto {
  status: string | null;
  quantidade: number;
}

export interface NotasFiscaisDashboardDto {
  periodo: { dataInicial: string | null; dataFinal: string | null };
  valorFaturado: string;
  contagemPorStatus: ContagemPorStatusNfeDto[];
}
