export interface VendasVsFaturadoMesDto {
  // "YYYY-MM" - sem depender de locale/timezone do front pra formatar.
  mes: string;
  valorVendido: string;
  valorFaturado: string;
}

export interface VendasVsFaturadoDashboardDto {
  periodo: { dataInicial: string | null; dataFinal: string | null };
  meses: VendasVsFaturadoMesDto[];
}
