import type { PedidoResumoDto } from "./pedidos";
import type { NotaFiscalDto } from "./notas-fiscais";

// Mesmo shape de backend/src/dashboard/dto/resumo-dashboard.dto.ts
// (ResumoDashboardDto) - duplicado aqui por não haver pacote compartilhado
// entre front e back.
export interface ResumoDashboardDto {
  clientesAtivos: number;
  produtosAtivos: number;
  pedidosEmAberto: number;
  valorFaturadoRecente: string;
  periodoValorFaturadoDias: number;
  pedidosRecentes: PedidoResumoDto[];
  notasFiscaisRecentes: NotaFiscalDto[];
}
