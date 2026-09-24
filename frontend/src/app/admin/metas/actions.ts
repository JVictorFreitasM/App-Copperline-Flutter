"use server";

import { revalidatePath } from "next/cache";
import { adminApiFetch } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";

const ROTA = "/admin/metas";

export interface EstadoDefinirMeta {
  erro: string | null;
  sucesso: string | null;
}

// Mesmo padrao de atualizarHierarquia (admin/vendedores/actions.ts) -
// assinatura (vendedorId, estadoAnterior, formData) pensada pra
// `.bind(null, vendedorId)` virar o formato que useActionState espera.
// PATCH /admin/vendedores/:id/meta e' protegido so por ApiKeyGuard (ver
// AdminMetasController) - adminApiFetch, nao apiFetch.
export async function definirMetaVendedor(
  vendedorId: string,
  _estadoAnterior: EstadoDefinirMeta,
  formData: FormData,
): Promise<EstadoDefinirMeta> {
  const mesAno = String(formData.get("mesAno") ?? "");
  const valorMetaRaw = String(formData.get("valorMeta") ?? "").trim();
  const valorMeta = Number(valorMetaRaw);

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mesAno)) {
    return { erro: "Informe um mês válido.", sucesso: null };
  }
  if (!valorMetaRaw || Number.isNaN(valorMeta) || valorMeta <= 0) {
    return { erro: "Meta precisa ser um número maior que zero.", sucesso: null };
  }

  try {
    await adminApiFetch(`/admin/vendedores/${encodeURIComponent(vendedorId)}/meta`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mesAno, valorMeta }),
      cache: "no-store",
    });
  } catch (error) {
    return {
      erro: error instanceof ApiError ? error.message : "Erro desconhecido ao definir meta.",
      sucesso: null,
    };
  }

  revalidatePath(ROTA);
  return { erro: null, sucesso: "Meta salva." };
}

// Toggle isolado (mesmo criterio de atualizarPermiteCheckinSemAgendamento) -
// sem useActionState, o proprio checkbox marcado/desmarcado apos o
// revalidatePath ja e' o feedback.
export async function atualizarRankingVisivelParaVendedor(visivel: boolean): Promise<void> {
  await adminApiFetch("/admin/gamificacao/configuracao", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rankingVisivelParaVendedor: visivel }),
    cache: "no-store",
  });
  revalidatePath(ROTA);
}
