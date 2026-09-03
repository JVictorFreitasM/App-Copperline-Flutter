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

// Mesmo shape de backend/src/dashboard/dto/periodo-query.dto.ts - dataInicial/
// dataFinal ISO ("YYYY-MM-DD"), ambos opcionais (omitidos = sem filtro de
// período, ver filtro-periodo.ts no backend). Devolvido de volta pelos
// endpoints (não só aceito) pra a tela confirmar o período que foi
// efetivamente aplicado.
export interface PeriodoDto {
  dataInicial: string | null;
  dataFinal: string | null;
}

export interface ContagemPorSituacaoDto {
  situacao: string | null;
  quantidade: number;
}

// Mesmo shape de backend/src/dashboard/dto/vendas-dashboard.dto.ts
// (VendasDashboardDto).
export interface VendasDashboardDto {
  periodo: PeriodoDto;
  totalPedidos: number;
  valorTotal: string;
  ticketMedio: string;
  contagemPorSituacao: ContagemPorSituacaoDto[];
}

export interface RankingItemDto {
  id: string;
  nome: string;
  valorTotal: string;
}

// Mesmo shape de backend/src/dashboard/dto/ranking-dashboard.dto.ts
// (RankingDashboardDto).
export interface RankingDashboardDto {
  periodo: PeriodoDto;
  topClientes: RankingItemDto[];
  topProdutos: RankingItemDto[];
  topVendedores: RankingItemDto[];
}

export interface ContagemPorStatusNfeDto {
  status: string | null;
  quantidade: number;
}

// Mesmo shape de backend/src/dashboard/dto/notas-fiscais-dashboard.dto.ts
// (NotasFiscaisDashboardDto).
export interface NotasFiscaisDashboardDto {
  periodo: PeriodoDto;
  valorFaturado: string;
  contagemPorStatus: ContagemPorStatusNfeDto[];
}

// Mesmo shape de backend/src/dashboard/dto/estoque-critico-dashboard.dto.ts
// (ProdutoEstoqueCriticoDto) - "crítico" já vem cruzado com pedido pendente
// pelo próprio backend (obterEstoqueCritico, dashboard.service.ts): só
// entra na lista quem está com saldo baixo E tem pelo menos um pedido em
// aberto pendente desse produto (ver critério de aceite da OS). Não é um
// filtro de período - a tela não passa dataInicial/dataFinal pra esse
// endpoint.
export interface ProdutoEstoqueCriticoDto {
  produtoId: string;
  nome: string | null;
  codigo: string;
  quantidadeDisponivel: string;
  quantidadePedidosPendentes: number;
}

export interface EstoqueCriticoDashboardDto {
  limiar: number;
  produtos: ProdutoEstoqueCriticoDto[];
}

export interface EtapaFunilDto {
  etapa: string;
  quantidade: number;
}

// Mesmo shape de backend/src/dashboard/dto/funil-pedidos-dashboard.dto.ts
// (FunilPedidosDashboardDto, OS-WEB-41) - etapas usam so' Pedido.situacao
// (real, sempre presente); cancelados/bloqueados sao estados de excecao,
// reportados a parte da progressao "Criado -> ... -> Concluído".
export interface FunilPedidosDashboardDto {
  periodo: PeriodoDto;
  etapas: EtapaFunilDto[];
  cancelados: number;
  bloqueados: number;
}

// Mesmo shape de backend/src/dashboard/dto/comparativo-vendedores.dto.ts
// (ComparativoVendedorDto, OS-WEB-40) - radar de 2 a 4 vendedores.
// taxaAprovacaoDesconto null = sem solicitação de desconto decidida no
// período (não "0% de aprovação").
export interface ComparativoVendedorDto {
  vendedorId: string;
  nome: string | null;
  valorVendido: number;
  ticketMedio: number;
  taxaAprovacaoDesconto: number | null;
  quantidadeVisitas: number;
}
