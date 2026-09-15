// Extraído de actions.ts (Next.js 16: um arquivo "use server" só pode
// exportar funções async - exportar essa constante/tipo de lá quebra TODAS
// as server actions do arquivo com "A server error occurred", não só o
// formulário que a usa). Tipo + valor inicial usados pelo useActionState
// dos formulários de edição manual do produto.
export interface EstadoEdicaoManual {
  erro: string | null;
  sucesso: string | null;
}

export const ESTADO_EDICAO_MANUAL_INICIAL: EstadoEdicaoManual = { erro: null, sucesso: null };
