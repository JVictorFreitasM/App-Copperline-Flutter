// Mesmo shape de backend/src/documentos/dto/documento-response.dto.ts
// (OS-BACKEND-41).
export interface DocumentoDto {
  id: string;
  nome: string;
  categoria: string;
  tipoMime: string;
  tamanhoBytes: number;
  enviadoPor: string;
  criadoEm: string;
}

export function formatarTamanhoArquivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
