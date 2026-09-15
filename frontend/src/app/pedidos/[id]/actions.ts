"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, ApiError } from "@/lib/api";

export interface EstadoDecisaoItem {
  erro: string | null;
}

const ESTADO_OK: EstadoDecisaoItem = { erro: null };

// Revisao por item (tela de detalhe do pedido, layout de referencia
// ref1.jpeg) - mesmo padrao de app/aprovacoes/actions.ts (useActionState +
// revalidatePath, sem redirect pra nao resetar o scroll da pagina).
async function decidir(path: string, pedidoId: string): Promise<EstadoDecisaoItem> {
  try {
    await apiFetch(path, { method: "POST", cache: "no-store" });
  } catch (error) {
    return {
      erro: error instanceof ApiError ? error.message : "Erro desconhecido ao decidir o item.",
    };
  }

  revalidatePath(`/pedidos/${pedidoId}`);
  return ESTADO_OK;
}

export async function aprovarItem(
  pedidoId: string,
  itemId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _estadoAnterior: EstadoDecisaoItem,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<EstadoDecisaoItem> {
  return decidir(`/pedidos/${pedidoId}/itens/${itemId}/aprovar`, pedidoId);
}

export async function rejeitarItem(
  pedidoId: string,
  itemId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _estadoAnterior: EstadoDecisaoItem,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<EstadoDecisaoItem> {
  return decidir(`/pedidos/${pedidoId}/itens/${itemId}/rejeitar`, pedidoId);
}

export async function aprovarTodosItens(
  pedidoId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _estadoAnterior: EstadoDecisaoItem,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<EstadoDecisaoItem> {
  return decidir(`/pedidos/${pedidoId}/itens/aprovar-tudo`, pedidoId);
}

export async function rejeitarTodosItens(
  pedidoId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _estadoAnterior: EstadoDecisaoItem,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<EstadoDecisaoItem> {
  return decidir(`/pedidos/${pedidoId}/itens/rejeitar-tudo`, pedidoId);
}
