"use server";

import { revalidatePath } from "next/cache";
import { adminApiFetch } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import type { AtualizarHierarquiaInput, PapelVendedor } from "@/lib/vendedores";

const ROTA = "/admin/vendedores";

export interface EstadoHierarquia {
  erro: string | null;
  sucesso: string | null;
}

// Formulário puro (mesmo padrão de admin/sincronizacao/actions.ts) - o
// <select> de papel e o de supervisor sempre têm um valor definido
// (mesmo "nenhum" pro supervisor), então sempre manda os dois campos -
// não é um PATCH parcial condicional, é sempre "o estado completo que a
// tela está mostrando agora".
//
// Assinatura (vendedorId, estadoAnterior, formData) - pensada pra
// `.bind(null, vendedorId)` virar exatamente o formato que useActionState
// espera: (estadoAnterior, formData) => Promise<EstadoHierarquia> (ver
// hierarquia-form.tsx). Sem redirect (OS-WEB-28) - revalidatePath re-
// renderiza a lista em Server Component no lugar, sem navegacao/scroll-reset.
export async function atualizarHierarquia(
  vendedorId: string,
  _estadoAnterior: EstadoHierarquia,
  formData: FormData,
): Promise<EstadoHierarquia> {
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
    return {
      erro: error instanceof ApiError ? error.message : "Erro desconhecido ao atualizar hierarquia.",
      sucesso: null,
    };
  }

  revalidatePath(ROTA);
  return { erro: null, sucesso: "Hierarquia atualizada." };
}
