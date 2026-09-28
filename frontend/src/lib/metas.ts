// Mesmo shape de backend/src/metas/meta-vendedor.service.ts /
// ranking-equipe.service.ts / configuracao-gamificacao.service.ts -
// duplicado aqui por não haver pacote compartilhado entre front e back.
export type TipoPeriodicidadeMeta = "MENSAL" | "SEMANAL";

// PESO usa Pedido.pesoLiquidoTotalKg (progresso real, em Kg) - MARGEM
// ainda sem cálculo de progresso implementado (pedido do usuário,
// 2026-09-28: "deixe apenas o nome margem, mas sem calcular nada ainda") -
// aparece como opção selecionável, mas percentualAtingido sempre vem null
// do backend pra esse tipo.
export type TipoMeta = "DINHEIRO" | "PESO" | "MARGEM";

export interface MetaProgressoDto {
  vendedorId: string;
  periodicidade: TipoPeriodicidadeMeta;
  periodo: string;
  // null = sem meta configurada pro período (nao "meta zero") -
  // percentualAtingido também fica null nesse caso.
  tipoMeta: TipoMeta | null;
  valorMeta: number | null;
  valorVendido: number;
  percentualAtingido: number | null;
}

export interface MetaVendedorDto {
  vendedorId: string;
  periodicidade: TipoPeriodicidadeMeta;
  periodo: string;
  tipoMeta: TipoMeta;
  valorMeta: number;
  atualizadoEm: string;
}

export interface RankingEquipeItemDto {
  vendedorId: string;
  nome: string | null;
  valorVendido: number;
}

export interface ConfiguracaoGamificacaoDto {
  rankingVisivelParaVendedor: boolean;
  atualizadoEm: string;
}

export const OPCOES_TIPO_META: { valor: TipoMeta; rotulo: string; unidade: string }[] = [
  { valor: "DINHEIRO", rotulo: "Dinheiro", unidade: "R$" },
  { valor: "PESO", rotulo: "Peso", unidade: "Kg" },
  // Sem cálculo de progresso ainda (ver comentário do tipo TipoMeta acima).
  { valor: "MARGEM", rotulo: "Margem de lucro", unidade: "%" },
];

export function rotuloTipoMeta(tipo: TipoMeta): string {
  return OPCOES_TIPO_META.find((opcao) => opcao.valor === tipo)?.rotulo ?? tipo;
}

// "YYYY-MM" do mes atual - default de periodo (periodicidade MENSAL) em
// toda consulta de meta/ranking (mesmo formato exigido pelo backend).
export function mesAnoAtual(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}`;
}

const FORMATADOR_MES = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

// "2026-09" -> "setembro de 2026" - new Date("2026-09-01") em vez de
// "2026-09" sozinho porque alguns browsers interpretam "YYYY-MM" sem dia
// como UTC e podem exibir o mes anterior em fusos negativos.
export function rotuloMesAno(mesAno: string): string {
  return FORMATADOR_MES.format(new Date(`${mesAno}-01T00:00:00`));
}

// "YYYY-Www" da semana ISO atual (segunda a domingo) - mesmo formato que
// <input type="week"> do navegador produz/aceita, e mesmo algoritmo do
// backend (ver backend/src/metas/filtro-semana.ts, semanaIsoAtual) -
// default de periodo quando periodicidade = SEMANAL.
export function semanaIsoAtual(): string {
  const agora = new Date();
  const dataAlvo = new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
  const diaSemanaIso = dataAlvo.getUTCDay() || 7;
  dataAlvo.setUTCDate(dataAlvo.getUTCDate() + 4 - diaSemanaIso);
  const anoIso = dataAlvo.getUTCFullYear();
  const primeiroDeJaneiro = new Date(Date.UTC(anoIso, 0, 1));
  const numeroSemana = Math.ceil(
    ((dataAlvo.getTime() - primeiroDeJaneiro.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${anoIso}-W${String(numeroSemana).padStart(2, "0")}`;
}

// "2026-W40" -> "semana 40 de 2026" - rótulo simples (sem tentar resolver
// as datas exatas de início/fim no client, o backend já valida o formato).
export function rotuloSemanaIso(periodo: string): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(periodo);
  if (!match) return periodo;
  return `semana ${match[2]} de ${match[1]}`;
}

// Default de periodo pra uma periodicidade - usado tanto no form de
// definir meta quanto na tela de progresso.
export function periodoAtual(periodicidade: TipoPeriodicidadeMeta): string {
  return periodicidade === "MENSAL" ? mesAnoAtual() : semanaIsoAtual();
}

export function rotuloPeriodo(periodicidade: TipoPeriodicidadeMeta, periodo: string): string {
  return periodicidade === "MENSAL" ? rotuloMesAno(periodo) : rotuloSemanaIso(periodo);
}
