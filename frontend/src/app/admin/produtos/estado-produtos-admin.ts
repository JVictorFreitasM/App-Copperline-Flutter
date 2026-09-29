// Extraído de actions.ts (Next.js 16: um arquivo "use server" só pode
// exportar funções async - exportar essa constante/tipo de lá quebra TODAS
// as server actions do arquivo com "A server error occurred", mesmo motivo
// de produtos/[id]/estado-edicao-manual.ts). Tipos + valores iniciais
// usados pelos formulários desta tela.
import type { ResultadoImagensLoteDto } from "@/lib/produtos";

export interface EstadoUploadLote {
  erro: string | null;
  resultado: ResultadoImagensLoteDto | null;
}

export const ESTADO_UPLOAD_LOTE_INICIAL: EstadoUploadLote = { erro: null, resultado: null };

export interface EstadoEdicaoManual {
  erro: string | null;
  sucesso: string | null;
}

export const ESTADO_EDICAO_MANUAL_INICIAL: EstadoEdicaoManual = { erro: null, sucesso: null };
