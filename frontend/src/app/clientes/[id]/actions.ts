"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";

// OS-novas-implementacoes.md Bloco 1 - protegido por requireRole('admin')
// no backend (mesmo criterio de AdminProdutosController), apiFetch normal
// (sessao), nao adminApiFetch.
export async function associarTabelaPreco(clienteId: string, codigo: string): Promise<void> {
  await apiFetch(`/admin/clientes/${encodeURIComponent(clienteId)}/tabelas-preco`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codigo }),
    cache: "no-store",
  });
  revalidatePath(`/clientes/${clienteId}`);
}

export async function desassociarTabelaPreco(clienteId: string, codigo: string): Promise<void> {
  await apiFetch(
    `/admin/clientes/${encodeURIComponent(clienteId)}/tabelas-preco/${encodeURIComponent(codigo)}`,
    { method: "DELETE", cache: "no-store" },
  );
  revalidatePath(`/clientes/${clienteId}`);
}
