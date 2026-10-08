"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";

// Protegido por requireRole('admin') no backend (admin/acessos).
const ROTA = "/admin/acessos";

export async function bloquearConta(contaId: string, motivo: string): Promise<void> {
  await apiFetch(`/admin/acessos/contas/${encodeURIComponent(contaId)}/bloquear`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ motivo: motivo.trim() || undefined }),
    cache: "no-store",
  });
  revalidatePath(ROTA);
}

export async function desbloquearConta(contaId: string): Promise<void> {
  await apiFetch(`/admin/acessos/contas/${encodeURIComponent(contaId)}/desbloquear`, {
    method: "POST",
    cache: "no-store",
  });
  revalidatePath(ROTA);
}

export async function encerrarSessao(idSessao: string): Promise<void> {
  await apiFetch(`/admin/acessos/sessoes/${encodeURIComponent(idSessao)}`, {
    method: "DELETE",
    cache: "no-store",
  });
  revalidatePath(ROTA);
}
