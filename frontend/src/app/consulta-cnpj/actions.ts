"use server";

import { apiFetch, ApiError } from "@/lib/api";
import { cepEhValido, normalizarCep, type ConsultaCepDto } from "@/lib/consulta-cep";
import {
  cnpjEhValido,
  formatarCnpj,
  normalizarCnpj,
  type ClienteJaCadastradoDto,
  type ConsultaCnpjDto,
  type ConsultaCnpjResultadoDto,
} from "@/lib/consulta-cnpj";

// Discriminado por `status` (mesmo padrão de estoque/actions.ts). Um campo
// só aceita CNPJ ou CEP: depois de tirar a pontuação, 8 dígitos é CEP e 14
// caracteres é CNPJ - os tamanhos nunca colidem.
export type ResultadoConsulta =
  | { status: "idle" }
  | { status: "invalido"; mensagem: string }
  | { status: "nao-encontrado"; mensagem: string }
  | { status: "limite"; mensagem: string }
  | { status: "cnpj-encontrado"; resultado: ConsultaCnpjDto }
  // CNPJ ja na base da empresa: o backend nem consulta a Receita.
  | { status: "ja-cadastrado"; cliente: ClienteJaCadastradoDto }
  | { status: "cep-encontrado"; resultado: ConsultaCepDto }
  | { status: "erro"; mensagem: string };

type TipoConsulta = "cnpj" | "cep";

function identificarTipo(entrada: string): TipoConsulta | null {
  if (cepEhValido(entrada)) {
    return "cep";
  }
  if (cnpjEhValido(entrada)) {
    return "cnpj";
  }
  return null;
}

export async function consultar(
  _estadoAnterior: ResultadoConsulta,
  formData: FormData,
): Promise<ResultadoConsulta> {
  const entrada = String(formData.get("termo") ?? "").trim();

  // Validação ANTES da chamada à API - os provedores externos têm limite de
  // requisições, entrada inválida nem sai do servidor do front.
  const tipo = identificarTipo(entrada);
  if (!tipo) {
    return {
      status: "invalido",
      mensagem:
        "Informe um CNPJ (14 caracteres) ou um CEP (8 dígitos) válido. Confira os dígitos verificadores do CNPJ.",
    };
  }

  try {
    if (tipo === "cep") {
      const resultado = await apiFetch<ConsultaCepDto>(
        `/consulta-cep/${encodeURIComponent(normalizarCep(entrada))}`,
        { cache: "no-store" },
      );
      return { status: "cep-encontrado", resultado };
    }

    const cnpj = normalizarCnpj(entrada);
    const resposta = await apiFetch<ConsultaCnpjResultadoDto>(`/consulta-cnpj/${encodeURIComponent(cnpj)}`, {
      cache: "no-store",
    });
    if (resposta.jaCadastrado) {
      return { status: "ja-cadastrado", cliente: resposta.jaCadastrado };
    }
    return { status: "cnpj-encontrado", resultado: resposta.dados! };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return {
        status: "nao-encontrado",
        mensagem:
          tipo === "cep"
            ? `CEP ${normalizarCep(entrada)} não encontrado.`
            : `CNPJ ${formatarCnpj(entrada)} não encontrado na Receita Federal.`,
      };
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
