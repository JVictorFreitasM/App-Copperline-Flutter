import type { EtapaFunil } from '../domain/montar-funil-pedidos';

export interface FunilPedidosDashboardDto {
  periodo: { dataInicial: string | null; dataFinal: string | null };
  etapas: EtapaFunil[];
  cancelados: number;
  bloqueados: number;
}
