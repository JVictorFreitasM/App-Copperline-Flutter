"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, ApiError } from "@/lib/api";
import { redirecionarParaLogin } from "@/lib/auth";

export interface EstadoDecisaoDesconto {
  erro: string | null;
  decidido: "APROVADO" | "REJEITADO" | null;
}

// Aceitar/recusar o desconto POR ITEM (POST /pedidos/:id/itens/:itemId/
// aprovar|rejeitar) ou de todos os itens ainda pendentes (itemId null ->
// .../itens/aprovar-tudo|rejeitar-tudo). Quem valida se o usuário tem alçada
// é o backend; quando o último item pendente é decidido o pedido segue só com
// os aceitos (ou é cancelado). Mesmo padrão de app/aprovacoes/actions.ts
// (revalidatePath, sem redirect, pra não resetar o scroll).
export async function decidirDescontoPedido(
  pedidoId: string,
  itemId: string | null,
  acao: "aprovar" | "rejeitar",
): Promise<EstadoDecisaoDesconto> {
  const caminho = itemId
    ? `/pedidos/${encodeURIComponent(pedidoId)}/itens/${encodeURIComponent(itemId)}/${acao}`
    : `/pedidos/${encodeURIComponent(pedidoId)}/itens/${acao}-tudo`;

  try {
    await apiFetch(caminho, { method: "POST", cache: "no-store" });
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
