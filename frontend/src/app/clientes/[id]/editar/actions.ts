"use server";

import { apiFetch, ApiError } from "@/lib/api";
import type { AtualizarClientePayload, ResultadoEdicaoDto } from "@/lib/cadastro-cliente";
import { extrairMensagemApi } from "@/lib/mensagem-erro-api";

export type ResultadoAtualizarCliente =
  | { status: "sucesso"; resultado: ResultadoEdicaoDto }
  | { status: "erro"; mensagem: string };

export async function atualizarClienteAction(
  clienteId: string,
  payload: AtualizarClientePayload,
): Promise<ResultadoAtualizarCliente> {
  try {
    const resultado = await apiFetch<ResultadoEdicaoDto>(`/clientes/${encodeURIComponent(clienteId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    return { status: "sucesso", resultado };
  } catch (error) {
    return {
      status: "erro",
      mensagem: error instanceof ApiError ? extrairMensagemApi(error) : "Erro desconhecido ao salvar o cliente.",
    };
  }
}
