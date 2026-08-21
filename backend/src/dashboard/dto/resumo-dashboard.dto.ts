import type { PedidoResumoDto } from '../../pedidos/dto/pedido-response.dto';
import type { NotaFiscalDto } from '../../notas-fiscais/dto/nota-fiscal-response.dto';

export interface ResumoDashboardDto {
  clientesAtivos: number;
  produtosAtivos: number;
  pedidosEmAberto: number;
  // Soma de pedidos FATURADO/ATENDIDO nos ultimos N dias - ver
  // periodoValorFaturadoDias pra saber qual N (decisao de produto, nao
  // hardcoded implicitamente sem expor o valor usado).
  valorFaturadoRecente: string;
  periodoValorFaturadoDias: number;
  pedidosRecentes: PedidoResumoDto[];
  notasFiscaisRecentes: NotaFiscalDto[];
}
