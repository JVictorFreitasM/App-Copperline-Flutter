"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";

const ROTA = "/aprovacoes";

async function decidir(id: string, acao: "aprovar" | "rejeitar"): Promise<void> {
  try {
    await apiFetch(`/solicitacoes-desconto/${encodeURIComponent(id)}/${acao}`, {
      method: "POST",
      cache: "no-store",
    });
  } catch (error) {
    redirect(
      `${ROTA}?erro=${encodeURIComponent(error instanceof ApiError ? error.message : "Erro desconhecido ao decidir a solicitação.")}`,
    );
  }

  revalidatePath(ROTA);
  redirect(
    `${ROTA}?sucesso=${encodeURIComponent(acao === "aprovar" ? "Solicitação aprovada." : "Solicitação rejeitada.")}`,
  );
}

// Dois Server Actions "puros" (mesmo padrão de admin/sincronizacao/actions.ts)
// - segundo parâmetro exigido pela assinatura de `<form action>`, não usado
// (a decisão não tem input próprio além de qual solicitação, já fixada
// pelo .bind no call site).
export async function aprovarSolicitacao(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<void> {
  await decidir(id, "aprovar");
}

export async function rejeitarSolicitacao(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<void> {
  await decidir(id, "rejeitar");
}
