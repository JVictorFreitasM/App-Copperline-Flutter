"use server";

import { apiFetch } from "@/lib/api";
import type {
  AlcadaAprovacaoDto,
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
