// Extraído de actions.ts (Next.js 16: um arquivo "use server" só pode
// exportar funções async).
export interface EstadoUpload {
  erro: string | null;
  sucesso: string | null;
}

export const ESTADO_UPLOAD_INICIAL: EstadoUpload = { erro: null, sucesso: null };

export interface EstadoRemocao {
  erro: string | null;
}

export const ESTADO_REMOCAO_INICIAL: EstadoRemocao = { erro: null };
