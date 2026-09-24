"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, ApiError } from "@/lib/api";
import type { AgendamentoVisitaDto } from "@/lib/agendamentos";

const ROTA = "/agendamentos";

export interface EstadoCriarAgendamento {
  erro: string | null;
  sucesso: string | null;
}

// POST /agendamentos-visita (OS-novas-implementacoes.md Bloco 5, ja
// existia so pro mobile) - protegido so por requireAuth, escopo individual
// (so agenda cliente que o proprio vendedor atende, ver
// AgendamentosVisitaService.criar) - apiFetch normal (sessao).
export async function criarAgendamento(
  _estadoAnterior: EstadoCriarAgendamento,
  formData: FormData,
): Promise<EstadoCriarAgendamento> {
  const clienteId = String(formData.get("clienteId") ?? "");
  const data = String(formData.get("data") ?? "");
  const hora = String(formData.get("hora") ?? "");

  if (!clienteId) {
    return { erro: "Selecione um cliente.", sucesso: null };
  }
  if (!data || !hora) {
    return { erro: "Informe data e hora previstas.", sucesso: null };
  }

  try {
    await apiFetch<AgendamentoVisitaDto>("/agendamentos-visita", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId,
        dataHoraPrevista: new Date(`${data}T${hora}`).toISOString(),
      }),
      cache: "no-store",
    });
  } catch (error) {
    return {
      erro: error instanceof ApiError ? error.message : "Erro desconhecido ao agendar.",
      sucesso: null,
    };
  }

  revalidatePath(ROTA);
  return { erro: null, sucesso: "Visita agendada." };
}
