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
  const periodicidade = String(formData.get("periodicidade") ?? "");
  const periodo = String(formData.get("periodo") ?? "");
  const tipoMeta = String(formData.get("tipoMeta") ?? "");
  const valorMetaRaw = String(formData.get("valorMeta") ?? "").trim();
  const valorMeta = Number(valorMetaRaw);

  if (periodicidade !== "MENSAL" && periodicidade !== "SEMANAL") {
    return { erro: "Selecione mensal ou semanal.", sucesso: null };
  }
  const formatoValido =
    periodicidade === "MENSAL"
      ? /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)
      : /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(periodo);
  if (!formatoValido) {
    return {
      erro: periodicidade === "MENSAL" ? "Informe um mês válido." : "Informe uma semana válida.",
      sucesso: null,
    };
  }
  if (tipoMeta !== "DINHEIRO" && tipoMeta !== "PESO" && tipoMeta !== "MARGEM") {
    return { erro: "Selecione o tipo de meta.", sucesso: null };
  }
  if (!valorMetaRaw || Number.isNaN(valorMeta) || valorMeta <= 0) {
    return { erro: "Meta precisa ser um número maior que zero.", sucesso: null };
  }

  try {
    await adminApiFetch(`/admin/vendedores/${encodeURIComponent(vendedorId)}/meta`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodicidade, periodo, tipoMeta, valorMeta }),
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
