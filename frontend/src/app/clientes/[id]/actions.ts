"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, ApiError } from "@/lib/api";
import type { VisitaResumoLlmDto } from "@/lib/visita-resumo-llm";

// OS-novas-implementacoes.md Bloco 1 - protegido por requireRole('admin')
// no backend (mesmo criterio de AdminProdutosController), apiFetch normal
// (sessao), nao adminApiFetch.
export async function associarTabelaPreco(clienteId: string, codigo: string): Promise<void> {
  await apiFetch(`/admin/clientes/${encodeURIComponent(clienteId)}/tabelas-preco`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codigo }),
    cache: "no-store",
  });
  revalidatePath(`/clientes/${clienteId}`);
}

export type ResultadoResumoVisitas =
  | { sucesso: true; resumo: VisitaResumoLlmDto }
  | { sucesso: false; erro: string };

// docs/casos-de-uso-ia.md secao 2.4 - resumo via LLM sob demanda (nao
// carregado junto com o resto da tela, ver ClienteDetalhePage): chamada de
// LLM paga, o backend ja cacheia 24h (GET /clientes/:id/resumo-visitas),
// mas so vale a pena pagar esse custo se o usuario realmente pedir. Erro
// capturado e devolvido como dado (nao deixado propagar cru pela boundary
// da Server Action) - mesmo criterio de criarTipoAcondicionamento/
// atualizarConfiguracaoLlm, senao a mensagem real vira generica no client.
export async function gerarResumoVisitas(clienteId: string): Promise<ResultadoResumoVisitas> {
  try {
    const resumo = await apiFetch<VisitaResumoLlmDto>(
      `/clientes/${encodeURIComponent(clienteId)}/resumo-visitas`,
      { cache: "no-store" },
    );
    return { sucesso: true, resumo };
  } catch (error) {
    return {
      sucesso: false,
      erro: error instanceof ApiError ? error.message : "Erro desconhecido ao gerar o resumo.",
    };
  }
}

export async function desassociarTabelaPreco(clienteId: string, codigo: string): Promise<void> {
  await apiFetch(
    `/admin/clientes/${encodeURIComponent(clienteId)}/tabelas-preco/${encodeURIComponent(codigo)}`,
    { method: "DELETE", cache: "no-store" },
  );
  revalidatePath(`/clientes/${clienteId}`);
}
