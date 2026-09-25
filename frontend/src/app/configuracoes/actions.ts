"use server";

import { apiFetch } from "@/lib/api";
import type {
  AlcadaAprovacaoDto,
  ChaveLlmDto,
  ConfiguracaoLlmDto,
  ConfiguracaoOrcamentoDto,
  ConfiguracaoRastreioDto,
} from "@/lib/configuracoes";

// Protegido por requireRole('admin') no backend (ver configuracoes.module.ts)
// - acao de configuracao feita por um humano logado pelo painel web, mesmo
// criterio de admin/tipos-acondicionamento. Sem revalidatePath: as 3 abas
// guardam o estado localmente (useState) e so' re-sincronizam no proximo
// carregamento da pagina - evita re-fetch das 3 configs a cada PATCH.
export async function atualizarAlcadaAprovacao(
  input: Omit<AlcadaAprovacaoDto, "atualizadoEm">,
): Promise<AlcadaAprovacaoDto> {
  return apiFetch<AlcadaAprovacaoDto>("/admin/configuracoes/alcada-aprovacao", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

export async function atualizarConfiguracaoOrcamento(
  input: Omit<ConfiguracaoOrcamentoDto, "atualizadoEm">,
): Promise<ConfiguracaoOrcamentoDto> {
  return apiFetch<ConfiguracaoOrcamentoDto>("/admin/configuracoes/orcamento", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

export async function atualizarConfiguracaoRastreio(
  input: Omit<ConfiguracaoRastreioDto, "atualizadoEm">,
): Promise<ConfiguracaoRastreioDto> {
  return apiFetch<ConfiguracaoRastreioDto>("/admin/configuracoes/rastreio", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

// Aba "LLM" (2026-09-24, unificada aqui - antes vivia sozinha em
// /admin/llm). GET/PATCH aqui so provedor/modelo - chaves em si via as
// funcoes de ChaveLlm abaixo.
export async function atualizarConfiguracaoLlm(
  input: Omit<ConfiguracaoLlmDto, "atualizadoEm">,
): Promise<ConfiguracaoLlmDto> {
  return apiFetch<ConfiguracaoLlmDto>("/admin/configuracoes/llm", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

export async function criarChaveLlm(input: { rotulo: string; apiKey: string }): Promise<ChaveLlmDto> {
  return apiFetch<ChaveLlmDto>("/admin/configuracoes/llm/chaves", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

export async function atualizarChaveLlm(
  id: string,
  input: { rotulo?: string; ativa?: boolean },
): Promise<ChaveLlmDto> {
  return apiFetch<ChaveLlmDto>(`/admin/configuracoes/llm/chaves/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

export async function removerChaveLlm(id: string): Promise<void> {
  await apiFetch(`/admin/configuracoes/llm/chaves/${encodeURIComponent(id)}`, {
    method: "DELETE",
    cache: "no-store",
  });
}

// Manda a LISTA INTEIRA de ids na nova ordem (drag-and-drop no client) -
// ver ChaveLlmService.reordenar no backend.
export async function reordenarChavesLlm(ids: string[]): Promise<ChaveLlmDto[]> {
  return apiFetch<ChaveLlmDto[]>("/admin/configuracoes/llm/chaves/ordem", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
    cache: "no-store",
  });
}
