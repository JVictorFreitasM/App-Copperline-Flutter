"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";
import type { AdminCondicaoPagamentoDto, AdminFormaPagamentoDto } from "@/lib/pagamento";

const ROTA = "/admin/pagamento";

export async function atualizarAtivoFormaPagamento(id: string, ativo: boolean): Promise<void> {
  await apiFetch<AdminFormaPagamentoDto>(`/admin/formas-pagamento/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ativo }),
    cache: "no-store",
  });
  revalidatePath(ROTA);
}

export async function atualizarAtivoCondicaoPagamento(id: string, ativo: boolean): Promise<void> {
  await apiFetch<AdminCondicaoPagamentoDto>(
    `/admin/condicoes-pagamento/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo }),
      cache: "no-store",
    },
  );
  revalidatePath(ROTA);
}
