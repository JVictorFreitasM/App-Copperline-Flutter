"use server";

import { apiFetch, ApiError } from "@/lib/api";
import type { ResultadoImagensLoteDto } from "@/lib/produtos";

export interface EstadoUploadLote {
  erro: string | null;
  resultado: ResultadoImagensLoteDto | null;
}

export const ESTADO_UPLOAD_LOTE_INICIAL: EstadoUploadLote = { erro: null, resultado: null };

// Protegido por requireRole('admin') via MiddlewareConsumer (ver
// produtos.module.ts) - mesmo padrão de enviarImagemProduto
// (produtos/[id]/actions.ts), so que em massa: FormData com varios
// arquivos sob o MESMO campo "imagens" (o browser já monta isso sozinho
// com <input type="file" multiple>, sem precisar iterar aqui). Nome de
// cada arquivo (sem extensão) = Produto.codigo - casamento feito no
// backend (ProdutoManualService.salvarImagensEmLote).
export async function enviarImagensEmLote(
  _estadoAnterior: EstadoUploadLote,
  formData: FormData,
): Promise<EstadoUploadLote> {
  const arquivos = formData.getAll("imagens").filter((valor) => valor instanceof File && valor.size > 0);
  if (arquivos.length === 0) {
    return { erro: "Selecione ao menos um arquivo de imagem.", resultado: null };
  }

  try {
    const resultado = await apiFetch<ResultadoImagensLoteDto>("/admin/produtos/imagens-em-lote", {
      method: "POST",
      body: formData,
      cache: "no-store",
    });
    return { erro: null, resultado };
  } catch (error) {
    return {
      erro: error instanceof ApiError ? error.message : "Erro desconhecido ao enviar as imagens.",
      resultado: null,
    };
  }
}
