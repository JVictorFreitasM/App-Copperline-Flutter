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

// Mesmo shape de backend/src/dashboard/dto/mapa-calor-vendas.dto.ts
// (OS-WEB-39) - so' clientes com Cliente.localizacaoLat/Lng definido (pin
// manual, OS-MOBILE-21) entram em `pontos`; totalClientesNoPeriodo deixa
// explícito que o mapa cobre só uma fatia dos clientes com pedido.
export interface PontoMapaCalorVendasDto {
  clienteId: string;
  nome: string | null;
  latitude: number;
  longitude: number;
  valorTotal: number;
}

export interface MapaCalorVendasDto {
  pontos: PontoMapaCalorVendasDto[];
  totalClientesNoPeriodo: number;
}

// Mesmo shape de backend/src/dashboard/dto/comparativo-mensal-dashboard.dto.ts
// (Epico 2, OS-dashboard-configuracoes-notificacoes-auditoria.md).
export interface ComparativoMensalMesDto {
  mes: number;
  valorAnoAtual: string;
  valorAnoAnterior: string;
}

export interface ComparativoMensalDashboardDto {
  anoAtual: number;
  anoAnterior: number;
  meses: ComparativoMensalMesDto[];
}

// Mesmo shape de backend/src/dashboard/dto/vendas-por-estado-dashboard.dto.ts
// (Epico 1.2). quantidadePedidosSemUf existe pra tela nunca fingir
// cobertura de 100% (so' ~7% dos pedidos tem UF de entrega).
export interface VendasPorEstadoDto {
  uf: string;
  valorTotal: string;
  quantidadePedidos: number;
}

export interface VendasPorEstadoDashboardDto {
  periodo: PeriodoDto;
  estados: VendasPorEstadoDto[];
  quantidadePedidosSemUf: number;
}

// Mesmo shape de backend/src/dashboard/dto/vendas-vs-faturado-dashboard.dto.ts
// (Epico 1.2).
export interface VendasVsFaturadoMesDto {
  mes: string;
  valorVendido: string;
  valorFaturado: string;
}

export interface VendasVsFaturadoDashboardDto {
  periodo: PeriodoDto;
  meses: VendasVsFaturadoMesDto[];
}

const NOMES_MES_ABREVIADOS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

// mesNumero: 1-12 (Janeiro=1, mesmo formato de ComparativoMensalMesDto.mes).
export function nomeMesAbreviado(mesNumero: number): string {
  return NOMES_MES_ABREVIADOS[mesNumero - 1] ?? String(mesNumero);
}

// "2026-01" -> "Jan/26".
export function rotuloAnoMes(anoMes: string): string {
  const [ano, mes] = anoMes.split("-");
  return `${nomeMesAbreviado(Number(mes))}/${ano.slice(2)}`;
}
