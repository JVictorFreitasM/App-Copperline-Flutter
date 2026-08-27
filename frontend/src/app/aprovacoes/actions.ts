"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, ApiError } from "@/lib/api";

const ROTA = "/aprovacoes";

export interface EstadoDecisao {
  erro: string | null;
  sucesso: string | null;
}

async function decidir(id: string, acao: "aprovar" | "rejeitar"): Promise<EstadoDecisao> {
  try {
    await apiFetch(`/solicitacoes-desconto/${encodeURIComponent(id)}/${acao}`, {
      method: "POST",
      cache: "no-store",
    });
  } catch (error) {
    return {
      erro: error instanceof ApiError ? error.message : "Erro desconhecido ao decidir a solicitação.",
      sucesso: null,
    };
  }

  // revalidatePath (sem redirect, OS-WEB-28) - re-renderiza a lista em
  // Server Component no lugar, sem navegacao nenhuma - e' isso que evita o
  // reset de scroll que `redirect(...)` causava aqui antes (toda navegacao,
  // mesmo client-side, volta pro topo por padrao e nao ha como desligar
  // isso especificamente em redirect(), so em Link/Form).
  revalidatePath(ROTA);
  return {
    erro: null,
    sucesso: acao === "aprovar" ? "Solicitação aprovada." : "Solicitação rejeitada.",
  };
}

// Assinatura (id, estadoAnterior, formData) pensada pra `.bind(null, id)`
// virar exatamente o formato que useActionState espera:
// (estadoAnterior, formData) => Promise<EstadoDecisao> (ver
// aprovar-rejeitar-form.tsx).
export async function aprovarSolicitacao(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _estadoAnterior: EstadoDecisao,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<EstadoDecisao> {
  return decidir(id, "aprovar");
}

export async function rejeitarSolicitacao(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _estadoAnterior: EstadoDecisao,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<EstadoDecisao> {
  return decidir(id, "rejeitar");
}
