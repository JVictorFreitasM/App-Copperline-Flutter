// Extraído de actions.ts (Next.js 16: um arquivo "use server" só pode
// exportar funções async).
export interface EstadoCriarTipo {
  erro: string | null;
  sucesso: string | null;
}

export const ESTADO_CRIAR_TIPO_INICIAL: EstadoCriarTipo = { erro: null, sucesso: null };
