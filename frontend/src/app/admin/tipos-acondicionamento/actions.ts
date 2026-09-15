"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, ApiError } from "@/lib/api";
import type { TipoAcondicionamentoDto } from "@/lib/tipos-acondicionamento";
import type { EstadoCriarTipo } from "./estado-criar-tipo";

const ROTA = "/admin/tipos-acondicionamento";

// OS-novas-implementacoes.md Bloco 4 - protegido por requireRole('admin')
// no backend (nao ApiKeyGuard - acao de catalogo feita por um humano
// logado pelo painel, mesmo criterio de AdminProdutosController), por
// isso apiFetch normal (sessao), nao adminApiFetch.
export async function criarTipoAcondicionamento(
  _estadoAnterior: EstadoCriarTipo,
  formData: FormData,
): Promise<EstadoCriarTipo> {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) {
    return { erro: "Informe um nome.", sucesso: null };
  }

  // Vazio = retalho (corte fracionario livre) - so envia tamanhoPadrao
  // quando o admin preencheu, senao o backend trataria "" como um numero
  // invalido em vez de "sem tamanho fixo".
  const tamanhoPadraoRaw = String(formData.get("tamanhoPadrao") ?? "").trim();
  const tamanhoPadrao = tamanhoPadraoRaw ? Number(tamanhoPadraoRaw) : undefined;
  if (tamanhoPadraoRaw && (Number.isNaN(tamanhoPadrao) || (tamanhoPadrao ?? 0) <= 0)) {
    return { erro: "Tamanho padrão precisa ser um número maior que zero.", sucesso: null };
  }

  try {
    await apiFetch<TipoAcondicionamentoDto>(ROTA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, ...(tamanhoPadrao !== undefined && { tamanhoPadrao }) }),
      cache: "no-store",
    });
  } catch (error) {
    return {
      erro: error instanceof ApiError ? error.message : "Erro desconhecido ao criar.",
      sucesso: null,
    };
  }

  revalidatePath(ROTA);
  return { erro: null, sucesso: `"${nome}" cadastrado.` };
}

export async function atualizarAtivoTipoAcondicionamento(
  tipoId: string,
  ativo: boolean,
): Promise<void> {
  await apiFetch<TipoAcondicionamentoDto>(`${ROTA}/${encodeURIComponent(tipoId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ativo }),
    cache: "no-store",
  });
  revalidatePath(ROTA);
}

// tamanhoPadrao null explicito limpa (volta a ser retalho) - distinto de
// undefined (nao enviar o campo), que o backend trata como "nao mexer".
export async function atualizarTamanhoPadraoTipoAcondicionamento(
  tipoId: string,
  tamanhoPadrao: number | null,
): Promise<void> {
  await apiFetch<TipoAcondicionamentoDto>(`${ROTA}/${encodeURIComponent(tipoId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tamanhoPadrao }),
    cache: "no-store",
  });
  revalidatePath(ROTA);
}
