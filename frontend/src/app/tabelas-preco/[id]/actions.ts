"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, ApiError } from "@/lib/api";
import type { TabelaPrecoResumoDto } from "@/lib/tabelas-preco";

export interface EstadoDefinirPadrao {
  erro: string | null;
}

export const ESTADO_DEFINIR_PADRAO_INICIAL: EstadoDefinirPadrao = { erro: null };

// "Trocar a tabela" (pedido do usuário) - só admin (backend valida via
// requireRole('admin'), ver admin-tabelas-preco.controller.ts).
export async function definirTabelaPadrao(
  tabelaId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _estadoAnterior: EstadoDefinirPadrao,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<EstadoDefinirPadrao> {
  try {
    await apiFetch<TabelaPrecoResumoDto>(
      `/admin/tabelas-preco/${encodeURIComponent(tabelaId)}/padrao`,
      { method: "PATCH", cache: "no-store" },
    );
  } catch (error) {
    return {
      erro: error instanceof ApiError ? error.message : "Erro desconhecido ao definir a tabela padrão.",
    };
  }

  revalidatePath(`/tabelas-preco/${tabelaId}`);
  revalidatePath("/tabelas-preco");
  return { erro: null };
}
