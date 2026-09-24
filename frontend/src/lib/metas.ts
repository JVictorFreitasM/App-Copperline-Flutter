// Mesmo shape de backend/src/metas/meta-vendedor.service.ts /
// ranking-equipe.service.ts / configuracao-gamificacao.service.ts -
// duplicado aqui por não haver pacote compartilhado entre front e back.
export interface MetaProgressoDto {
  vendedorId: string;
  mesAno: string;
  // null = sem meta configurada pro mes (nao "meta zero") - percentualAtingido
  // tambem fica null nesse caso.
  valorMeta: number | null;
  valorVendido: number;
  percentualAtingido: number | null;
}

export interface MetaVendedorDto {
  vendedorId: string;
  mesAno: string;
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

// "YYYY-MM" do mes atual - default de mesAno em toda consulta de meta/
// ranking (mesmo formato exigido pelo backend, MesAnoQueryDto).
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
