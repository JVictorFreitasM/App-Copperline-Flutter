"use server";

import { revalidatePath } from "next/cache";
import { adminApiFetch } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import type { CoberturaTemporariaDto, CriarCoberturaInput } from "@/lib/coberturas";

const ROTA = "/admin/coberturas";

export interface EstadoCriarCobertura {
  erro: string | null;
  sucesso: string | null;
}

// POST /admin/coberturas e' protegido so por ApiKeyGuard (ver
// AdminCoberturasController) - adminApiFetch, mesmo padrao de
// admin/metas/actions.ts.
export async function criarCobertura(
  _estadoAnterior: EstadoCriarCobertura,
  formData: FormData,
): Promise<EstadoCriarCobertura> {
  const vendedorOriginalId = String(formData.get("vendedorOriginalId") ?? "");
  const vendedorSubstitutoId = String(formData.get("vendedorSubstitutoId") ?? "");
  const dataInicio = String(formData.get("dataInicio") ?? "");
  const dataFim = String(formData.get("dataFim") ?? "");

  if (!vendedorOriginalId || !vendedorSubstitutoId) {
    return { erro: "Selecione o vendedor original e o substituto.", sucesso: null };
  }
  if (vendedorOriginalId === vendedorSubstitutoId) {
    return { erro: "Vendedor original e substituto não podem ser o mesmo.", sucesso: null };
  }
  if (!dataInicio || !dataFim) {
    return { erro: "Informe o período da cobertura.", sucesso: null };
  }

  const input: CriarCoberturaInput = {
    vendedorOriginalId,
    vendedorSubstitutoId,
    dataInicio,
    dataFim,
  };

  try {
    await adminApiFetch<CoberturaTemporariaDto>("/admin/coberturas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch (error) {
    return {
      erro: error instanceof ApiError ? error.message : "Erro desconhecido ao criar cobertura.",
      sucesso: null,
    };
  }

  revalidatePath(ROTA);
  return { erro: null, sucesso: "Cobertura criada." };
}
