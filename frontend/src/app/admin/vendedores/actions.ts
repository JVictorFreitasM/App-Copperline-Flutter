"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminApiFetch } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import type { AtualizarHierarquiaInput, PapelVendedor } from "@/lib/vendedores";

const ROTA = "/admin/vendedores";

// Formulário puro (mesmo padrão de admin/sincronizacao/actions.ts) - o
// <select> de papel e o de supervisor sempre têm um valor definido
// (mesmo "nenhum" pro supervisor), então sempre manda os dois campos -
// não é um PATCH parcial condicional, é sempre "o estado completo que a
// tela está mostrando agora".
export async function atualizarHierarquia(
  vendedorId: string,
  formData: FormData,
): Promise<void> {
  const papel = String(formData.get("papel")) as PapelVendedor;
  const supervisorIdRaw = formData.get("supervisorId");

  const input: AtualizarHierarquiaInput = {
    papel,
    supervisorId: supervisorIdRaw ? String(supervisorIdRaw) : null,
  };

  try {
    await adminApiFetch(`/admin/vendedores/${encodeURIComponent(vendedorId)}/hierarquia`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch (error) {
    redirect(
      `${ROTA}?erro=${encodeURIComponent(error instanceof ApiError ? error.message : "Erro desconhecido ao atualizar hierarquia.")}`,
    );
  }

  revalidatePath(ROTA);
  redirect(`${ROTA}?sucesso=${encodeURIComponent("Hierarquia atualizada.")}`);
}
