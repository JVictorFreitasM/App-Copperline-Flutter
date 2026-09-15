// Extraído de actions.ts (Next.js 16: um arquivo "use server" só pode
// exportar funções async).
export interface ImportarSwaggerResultado {
  nomeEntidade: string;
  avisoRevisaoNecessaria: true;
  modeloPrismaRascunho: string;
  syncStrategyRascunho: string;
  camposNaoMapeados: string[];
}

export interface EstadoImportacao {
  resultado: ImportarSwaggerResultado | null;
  erro: string | null;
}

export const ESTADO_INICIAL: EstadoImportacao = { resultado: null, erro: null };
