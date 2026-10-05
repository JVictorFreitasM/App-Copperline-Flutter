"use server";

import { apiFetch, ApiError } from "@/lib/api";
import { cnpjEhValido, normalizarCnpj, type ConsultaCnpjDto } from "@/lib/consulta-cnpj";

// Discriminado por `status` (mesmo padrão de estoque/actions.ts).
export type ResultadoConsultaCnpj =
  | { status: "idle" }
  | { status: "invalido"; mensagem: string }
  | { status: "nao-encontrado"; cnpj: string }
  | { status: "limite"; mensagem: string }
  | { status: "encontrado"; resultado: ConsultaCnpjDto }
  | { status: "erro"; mensagem: string };

export async function consultarCnpj(
  _estadoAnterior: ResultadoConsultaCnpj,
  formData: FormData,
): Promise<ResultadoConsultaCnpj> {
  const entrada = String(formData.get("cnpj") ?? "").trim();

  // Validação ANTES da chamada à API - o provedor externo tem limite de
  // requisições, CNPJ inválido nem sai do servidor do front.
  if (!cnpjEhValido(entrada)) {
    return {
      status: "invalido",
      mensagem: "CNPJ inválido. Confira os 14 caracteres e os dígitos verificadores.",
    };
  }

  const cnpj = normalizarCnpj(entrada);
  try {
    const resultado = await apiFetch<ConsultaCnpjDto>(`/consulta-cnpj/${encodeURIComponent(cnpj)}`, {
      cache: "no-store",
    });
    return { status: "encontrado", resultado };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { status: "nao-encontrado", cnpj };
    }
    if (error instanceof ApiError && error.status === 429) {
      return { status: "limite", mensagem: "Muitas consultas seguidas. Aguarde alguns instantes e tente de novo." };
    }
    return {
      status: "erro",
      mensagem: error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.",
    };
  }
}
