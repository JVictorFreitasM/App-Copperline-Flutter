"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";
import type { PaginatedResult } from "@/lib/pagination";
import type { NotificacaoDto } from "@/lib/notificacoes";

const ROTA = "/notificacoes";

// Epico 5 - protegido so por requireAuth no backend (sempre "minhas
// notificacoes", ver NotificacoesController), apiFetch normal (sessao).
// Reaproveitado tanto pela tela cheia (/notificacoes) quanto pelo sino da
// Topbar (dropdown com as ultimas + contagem) - Server Actions podem ser
// chamadas direto de um Client Component (onClick/useEffect), nao so de
// <form>, mesmo padrao ja usado no resto do projeto.

export async function buscarContagemNaoLidas(): Promise<number> {
  const resultado = await apiFetch<{ quantidade: number }>("/notificacoes/contagem-nao-lidas", {
    cache: "no-store",
  });
  return resultado.quantidade;
}

export async function buscarNotificacoesRecentes(limite = 5): Promise<NotificacaoDto[]> {
  const resultado = await apiFetch<PaginatedResult<NotificacaoDto>>(
    `/notificacoes?limit=${limite}`,
    { cache: "no-store" },
  );
  return resultado.data;
}

export async function marcarNotificacaoComoLida(id: string): Promise<void> {
  await apiFetch<NotificacaoDto>(`/notificacoes/${encodeURIComponent(id)}/lida`, {
    method: "PATCH",
    cache: "no-store",
  });
  revalidatePath(ROTA);
}

export async function marcarTodasComoLidas(): Promise<void> {
  await apiFetch<{ quantidade: number }>("/notificacoes/marcar-todas-lidas", {
    method: "PATCH",
    cache: "no-store",
  });
  revalidatePath(ROTA);
}
