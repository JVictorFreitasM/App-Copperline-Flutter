"use server";

import { revalidatePath } from "next/cache";
import { adminApiFetch } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import type { AtualizarConfiguracaoSyncInput, TipoCadenciaSync } from "@/lib/admin-sync";
import { rotuloEntidade } from "@/lib/admin-sync";

const ROTA = "/admin/sincronizacao";

export interface EstadoSync {
  erro: string | null;
  sucesso: string | null;
}

function mensagemErro(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

// useActionState em client component (cadencia-form.tsx/rodar-agora-form.tsx)
// em vez de redirect com erro/sucesso na query string (OS-WEB-28: redirect()
// nao aceita scroll={false} como Link/Form, entao toda chamada resetava o
// scroll da pagina pro topo). revalidatePath continua fazendo o trabalho de
// atualizar a lista - so a navegacao extra pro `?sucesso=`/`?erro=` foi
// removida.
//
// Assinatura (nomeEntidade, estadoAnterior, formData) - pensada pra
// `.bind(null, nomeEntidade)` virar exatamente o formato que useActionState
// espera: (estadoAnterior, formData) => Promise<EstadoSync>.
export async function atualizarCadencia(
  nomeEntidade: string,
  _estadoAnterior: EstadoSync,
  formData: FormData,
): Promise<EstadoSync> {
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
    return { erro: mensagemErro(error, "Erro desconhecido ao atualizar cadência."), sucesso: null };
  }

  revalidatePath(ROTA);
  return { erro: null, sucesso: `Cadência de '${rotuloEntidade(nomeEntidade)}' atualizada.` };
}

export async function rodarAgora(
  nomeEntidade: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _estadoAnterior: EstadoSync,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<EstadoSync> {
  try {
    await adminApiFetch(`/admin/sync/${encodeURIComponent(nomeEntidade)}/executar-agora`, {
      method: "POST",
      cache: "no-store",
    });
  } catch (error) {
    return {
      erro: mensagemErro(error, "Erro desconhecido ao disparar sincronização."),
      sucesso: null,
    };
  }

  revalidatePath(ROTA);
  return {
    erro: null,
    sucesso: `Sincronização de '${rotuloEntidade(nomeEntidade)}' disparada - o status atualiza quando a execução terminar (recarregue a página).`,
  };
}
