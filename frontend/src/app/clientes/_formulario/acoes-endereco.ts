"use server";

import { apiFetch, ApiError } from "@/lib/api";
import type { GeocodificacaoDto } from "@/lib/cadastro-cliente";
import type { ConsultaCepDto } from "@/lib/consulta-cep";
import { cepEhValido, normalizarCep } from "@/lib/consulta-cep";
import { extrairMensagemApi } from "@/lib/mensagem-erro-api";

// Ações do popup de endereço, usadas tanto no cadastro quanto na edição de
// cliente. Tudo passa pelo backend (cache e limites de cada provedor) - o
// navegador nunca fala direto com a API de CEP nem com o serviço de mapas.

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
      mensagem: error instanceof ApiError ? extrairMensagemApi(error) : "Erro desconhecido ao consultar o CEP.",
    };
  }
}

export type ResultadoLocalizacao =
  | { status: "ok"; local: GeocodificacaoDto }
  | { status: "nao-encontrado" }
  | { status: "erro"; mensagem: string };

// "Localizar": tenta cada texto (do mais específico pro mais geral) até o
// mapa achar. Cada tentativa passa pelo backend (cache + limite de 1 req/s do
// Nominatim).
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
        mensagem: error instanceof ApiError ? extrairMensagemApi(error) : "Erro desconhecido ao localizar o endereço.",
      };
    }
  }
  return { status: "nao-encontrado" };
}
