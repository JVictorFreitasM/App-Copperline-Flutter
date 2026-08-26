"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminApiFetch } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import type { AtualizarConfiguracaoSyncInput, TipoCadenciaSync } from "@/lib/admin-sync";
import { rotuloEntidade } from "@/lib/admin-sync";

const ROTA = "/admin/sincronizacao";

function mensagemErro(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

// Formulário puro (sem useActionState/Client Component, ver
// page.tsx - "Server Components quando não houver necessidade de
// interatividade no cliente") - erro/sucesso viajam via query string do
// próprio redirect de volta pra tela, que os lê em searchParams.
export async function atualizarCadencia(
  nomeEntidade: string,
  formData: FormData,
): Promise<void> {
  const tipoCadencia = String(formData.get("tipoCadencia")) as TipoCadenciaSync;
  const intervaloMinutosRaw = formData.get("intervaloMinutos");
  const horarioFixoRaw = formData.get("horarioFixo");
  const diasSemana = formData.getAll("diasSemana").map(Number);

  const input: AtualizarConfiguracaoSyncInput = {
    tipoCadencia,
    ...(intervaloMinutosRaw ? { intervaloMinutos: Number(intervaloMinutosRaw) } : {}),
    ...(horarioFixoRaw ? { horarioFixo: String(horarioFixoRaw) } : {}),
    ...(diasSemana.length > 0 ? { diasSemana } : {}),
  };

  try {
    await adminApiFetch(`/admin/sync/configuracoes/${encodeURIComponent(nomeEntidade)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch (error) {
    redirect(
      `${ROTA}?erro=${encodeURIComponent(mensagemErro(error, "Erro desconhecido ao atualizar cadência."))}`,
    );
  }

  revalidatePath(ROTA);
  redirect(
    `${ROTA}?sucesso=${encodeURIComponent(`Cadência de '${rotuloEntidade(nomeEntidade)}' atualizada.`)}`,
  );
}

// Segundo parâmetro exigido pela assinatura de Server Action usada como
// `<form action>` (recebe o FormData mesmo sem campos) - não usado aqui,
// "Rodar agora" não tem input próprio além de qual entidade (já fixada
// pelo .bind no call site).
export async function rodarAgora(
  nomeEntidade: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<void> {
  try {
    await adminApiFetch(`/admin/sync/${encodeURIComponent(nomeEntidade)}/executar-agora`, {
      method: "POST",
      cache: "no-store",
    });
  } catch (error) {
    redirect(
      `${ROTA}?erro=${encodeURIComponent(mensagemErro(error, "Erro desconhecido ao disparar sincronização."))}`,
    );
  }

  revalidatePath(ROTA);
  redirect(
    `${ROTA}?sucesso=${encodeURIComponent(
      `Sincronização de '${rotuloEntidade(nomeEntidade)}' disparada - o status atualiza quando a execução terminar (recarregue a página).`,
    )}`,
  );
}
