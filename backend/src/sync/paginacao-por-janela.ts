import type { SyncWindow } from './sync-strategy.interface';

// O WK Radar nao pagina (sem page/limit/offset/token de proxima pagina -
// ver skill wk-radar-client, secao "Paginacao"). Cada strategy fatia a
// janela total em sub-janelas menores e itera, em vez de uma chamada so
// cobrindo tudo desde a ultima sincronizacao ate agora.

// Contagens "redondas" o suficiente pra levantar suspeita de truncamento
// silencioso nao documentado pela API - a API nao avisa se cortou a
// resposta, entao essa heuristica e a unica defesa disponivel.
const CONTAGENS_SUSPEITAS = new Set([
  100, 200, 250, 500, 1000, 2000, 5000, 10000,
]);

export function contagemSuspeitaDeTruncamento(quantidade: number): boolean {
  return CONTAGENS_SUSPEITAS.has(quantidade);
}

// Divide [janela.desde, janela.ate) em sub-janelas consecutivas de no
// maximo tamanhoMs cada. Se desde >= ate, retorna lista vazia (nada a
// sincronizar nesta execucao).
export function gerarSubJanelas(
  janela: SyncWindow,
  tamanhoMs: number,
): SyncWindow[] {
  const subJanelas: SyncWindow[] = [];
  let desde = janela.desde;

  while (desde < janela.ate) {
    const ate = new Date(
      Math.min(desde.getTime() + tamanhoMs, janela.ate.getTime()),
    );
    subJanelas.push({ desde, ate });
    desde = ate;
  }

  return subJanelas;
}

export interface ResultadoBuscaPaginada<T> {
  registros: T[];
  avisos: string[];
}

// Itera as sub-janelas sequencialmente (nunca em paralelo - respeita o
// throttling de 4 req/s da Radar.API), agregando os registros de cada
// chamada e sinalizando aviso quando uma sub-janela isolada retorna uma
// contagem suspeita de truncamento.
export async function buscarPorJanelas<T>(
  janela: SyncWindow,
  tamanhoMs: number,
  buscarSubJanela: (subJanela: SyncWindow) => Promise<T[]>,
): Promise<ResultadoBuscaPaginada<T>> {
  const registros: T[] = [];
  const avisos: string[] = [];

  for (const subJanela of gerarSubJanelas(janela, tamanhoMs)) {
    const pagina = await buscarSubJanela(subJanela);

    if (contagemSuspeitaDeTruncamento(pagina.length)) {
      avisos.push(
        `Sub-janela ${subJanela.desde.toISOString()} a ${subJanela.ate.toISOString()} retornou exatamente ${pagina.length} registro(s) - suspeita de truncamento silencioso nao documentado pela API`,
      );
    }

    registros.push(...pagina);
  }

  return { registros, avisos };
}
