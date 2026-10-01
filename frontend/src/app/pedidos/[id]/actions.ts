"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, ApiError } from "@/lib/api";
import { redirecionarParaLogin } from "@/lib/auth";

export interface EstadoDecisaoDesconto {
  erro: string | null;
  decidido: "APROVADO" | "REJEITADO" | null;
}

// Aceitar/recusar o desconto do pedido = decidir a SolicitacaoDesconto dele
// (POST /solicitacoes-desconto/:id/aprovar|rejeitar) - quem valida se o
// usuario tem alcada pra isso e' o backend, nao esta tela. Mesmo padrao de
// app/aprovacoes/actions.ts (revalidatePath, sem redirect, pra nao resetar
// o scroll).
export async function decidirDescontoPedido(
  pedidoId: string,
  solicitacaoId: string,
  acao: "aprovar" | "rejeitar",
): Promise<EstadoDecisaoDesconto> {
  try {
    await apiFetch(`/solicitacoes-desconto/${encodeURIComponent(solicitacaoId)}/${acao}`, {
      method: "POST",
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return redirecionarParaLogin(`/pedidos/${pedidoId}`);
    }
    return {
      erro: error instanceof ApiError ? error.message : "Erro desconhecido ao decidir o desconto.",
      decidido: null,
    };
  }

  revalidatePath(`/pedidos/${pedidoId}`);
  return { erro: null, decidido: acao === "aprovar" ? "APROVADO" : "REJEITADO" };
}
