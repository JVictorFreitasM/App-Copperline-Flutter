"use server";

import { apiFetch, ApiError } from "@/lib/api";
import type { ClienteCriadoDto, CriarClientePayload } from "@/lib/cadastro-cliente";
import { normalizarDocumento, tipoPessoaDoDocumento } from "@/lib/cadastro-cliente";
import type { ClienteJaCadastradoDto, ConsultaCnpjResultadoDto } from "@/lib/consulta-cnpj";
import { extrairMensagemApi } from "@/lib/mensagem-erro-api";

// ---------------------------------------------------------------- documento
// Validação por cálculo ANTES de qualquer chamada. CNPJ: o backend checa a
// base da empresa, depois o cache e só então a Receita. CPF: só checa a base
// (não há consulta pública de CPF).
export type ResultadoDocumento =
  | { status: "cnpj"; resultado: ConsultaCnpjResultadoDto }
  | { status: "cpf-livre" }
  | { status: "ja-cadastrado"; cliente: ClienteJaCadastradoDto }
  | { status: "invalido" }
  | { status: "nao-encontrado"; mensagem: string }
  | { status: "limite"; mensagem: string }
  | { status: "erro"; mensagem: string };

export async function consultarDocumentoAction(entrada: string): Promise<ResultadoDocumento> {
  const tipo = tipoPessoaDoDocumento(entrada);
  if (!tipo) {
    return { status: "invalido" };
  }
  const documento = normalizarDocumento(entrada);

  try {
    if (tipo === "Fisica") {
      const conflito = await apiFetch<{ existe: boolean; vendedorResponsavel: string | null }>(
        `/clientes/verificar-conflito?documento=${encodeURIComponent(documento)}`,
        { cache: "no-store" },
      );
      return conflito.existe
        ? {
            status: "ja-cadastrado",
            cliente: {
              razaoSocial: null,
              nomeFantasia: null,
              vendedorResponsavel: conflito.vendedorResponsavel,
              statusEnvioErp: "ENVIADO",
            },
          }
        : { status: "cpf-livre" };
    }

    const resultado = await apiFetch<ConsultaCnpjResultadoDto>(
      `/consulta-cnpj/${encodeURIComponent(documento)}`,
      { cache: "no-store" },
    );
    return resultado.jaCadastrado
      ? { status: "ja-cadastrado", cliente: resultado.jaCadastrado }
      : { status: "cnpj", resultado };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { status: "nao-encontrado", mensagem: "CNPJ não encontrado na Receita Federal - preencha manualmente." };
    }
    if (error instanceof ApiError && error.status === 429) {
      return { status: "limite", mensagem: "Muitas consultas seguidas. Aguarde alguns instantes." };
    }
    return {
      status: "erro",
      mensagem: error instanceof ApiError ? extrairMensagemApi(error) : "Erro desconhecido ao consultar o documento.",
    };
  }
}

// ----------------------------------------------------------------- cadastro
export type ResultadoCriarCliente =
  | { status: "sucesso"; cliente: ClienteCriadoDto }
  | { status: "erro"; mensagem: string };

export async function criarClienteAction(payload: CriarClientePayload): Promise<ResultadoCriarCliente> {
  try {
    const cliente = await apiFetch<ClienteCriadoDto>("/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    return { status: "sucesso", cliente };
  } catch (error) {
    return {
      status: "erro",
      mensagem: error instanceof ApiError ? extrairMensagemApi(error) : "Erro desconhecido ao cadastrar o cliente.",
    };
  }
}
