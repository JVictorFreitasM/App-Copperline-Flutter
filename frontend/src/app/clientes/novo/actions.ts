"use server";

import { apiFetch, ApiError } from "@/lib/api";
import type { ClienteCriadoDto, CriarClientePayload, GeocodificacaoDto } from "@/lib/cadastro-cliente";
import { normalizarDocumento, tipoPessoaDoDocumento } from "@/lib/cadastro-cliente";
import type { ConsultaCepDto } from "@/lib/consulta-cep";
import { cepEhValido, normalizarCep } from "@/lib/consulta-cep";
import type { ClienteJaCadastradoDto, ConsultaCnpjResultadoDto } from "@/lib/consulta-cnpj";

// O backend devolve o corpo do erro dentro da mensagem do ApiError
// ("API respondeu 409 para ...: {"message":"..."}") - extrai só o texto.
function extrairMensagem(error: ApiError): string {
  const inicioJson = error.message.indexOf("{");
  if (inicioJson === -1) {
    return error.message;
  }
  try {
    const corpo = JSON.parse(error.message.slice(inicioJson)) as { message?: string | string[] };
    return Array.isArray(corpo.message) ? corpo.message.join("; ") : (corpo.message ?? error.message);
  } catch {
    return error.message;
  }
}

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
      mensagem: error instanceof ApiError ? extrairMensagem(error) : "Erro desconhecido ao consultar o documento.",
    };
  }
}

// ---------------------------------------------------------------------- CEP
export type ResultadoCep =
  | { status: "ok"; cep: ConsultaCepDto }
  | { status: "nao-encontrado" }
  | { status: "erro"; mensagem: string };

export async function buscarCepAction(entrada: string): Promise<ResultadoCep> {
  if (!cepEhValido(entrada)) {
    return { status: "erro", mensagem: "CEP inválido." };
  }
  try {
    const cep = await apiFetch<ConsultaCepDto>(`/consulta-cep/${encodeURIComponent(normalizarCep(entrada))}`, {
      cache: "no-store",
    });
    return { status: "ok", cep };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { status: "nao-encontrado" };
    }
    return {
      status: "erro",
      mensagem: error instanceof ApiError ? extrairMensagem(error) : "Erro desconhecido ao consultar o CEP.",
    };
  }
}

// ------------------------------------------------------------------- mapa
export type ResultadoLocalizacao =
  | { status: "ok"; local: GeocodificacaoDto }
  | { status: "nao-encontrado" }
  | { status: "erro"; mensagem: string };

// "Localizar": tenta cada texto (do mais específico pro mais geral) até o
// mapa achar. Cada tentativa passa pelo backend (cache + limite de 1 req/s do
// Nominatim) - nunca direto do navegador.
export async function localizarEnderecoAction(consultas: string[]): Promise<ResultadoLocalizacao> {
  for (const consulta of consultas.slice(0, 3)) {
    try {
      const local = await apiFetch<GeocodificacaoDto>(`/geocodificacao?q=${encodeURIComponent(consulta)}`, {
        cache: "no-store",
      });
      return { status: "ok", local };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        continue;
      }
      return {
        status: "erro",
        mensagem: error instanceof ApiError ? extrairMensagem(error) : "Erro desconhecido ao localizar o endereço.",
      };
    }
  }
  return { status: "nao-encontrado" };
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
      mensagem: error instanceof ApiError ? extrairMensagem(error) : "Erro desconhecido ao cadastrar o cliente.",
    };
  }
}
