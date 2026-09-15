// Extraído de actions.ts (Next.js 16: um arquivo "use server" só pode
// exportar funções async).
export interface EstadoSelecaoTabela {
  erro: string | null;
  sucesso: string | null;
}

export const ESTADO_SELECAO_TABELA_INICIAL: EstadoSelecaoTabela = { erro: null, sucesso: null };
