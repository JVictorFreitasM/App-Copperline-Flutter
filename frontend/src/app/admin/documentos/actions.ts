"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, ApiError } from "@/lib/api";
import type { DocumentoDto } from "@/lib/documentos";

const ROTA = "/admin/documentos";

function mensagemErro(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export interface EstadoUpload {
  erro: string | null;
  sucesso: string | null;
}

export const ESTADO_UPLOAD_INICIAL: EstadoUpload = { erro: null, sucesso: null };

// Campos do FormData (nome/categoria/arquivo) já batem 1:1 com o que
// AdminDocumentosController espera (OS-BACKEND-41) - repassa o próprio
// FormData como body, sem reconstruir nem setar Content-Type manualmente
// (fetch define o boundary multipart sozinho quando o body é FormData).
export async function uploadDocumento(
  _estadoAnterior: EstadoUpload,
  formData: FormData,
): Promise<EstadoUpload> {
  const nome = String(formData.get("nome") ?? "").trim();
  const arquivo = formData.get("arquivo");
  if (!nome || !(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Preencha o nome e selecione um arquivo.", sucesso: null };
  }

  try {
    const documento = await apiFetch<DocumentoDto>("/admin/documentos", {
      method: "POST",
      body: formData,
      cache: "no-store",
    });
    revalidatePath(ROTA);
    return { erro: null, sucesso: `Documento "${documento.nome}" enviado.` };
  } catch (error) {
    return { erro: mensagemErro(error, "Erro desconhecido ao enviar o documento."), sucesso: null };
  }
}

export interface EstadoRemocao {
  erro: string | null;
}

export const ESTADO_REMOCAO_INICIAL: EstadoRemocao = { erro: null };

export async function removerDocumento(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _estadoAnterior: EstadoRemocao,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<EstadoRemocao> {
  try {
    await apiFetch(`/admin/documentos/${encodeURIComponent(id)}`, {
      method: "DELETE",
      cache: "no-store",
    });
  } catch (error) {
    return { erro: mensagemErro(error, "Erro desconhecido ao remover o documento.") };
  }

  revalidatePath(ROTA);
  return { erro: null };
}
