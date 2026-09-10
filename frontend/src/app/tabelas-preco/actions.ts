"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, ApiError } from "@/lib/api";
import type { ConfiguracaoTabelaPrecoDto } from "@/lib/tabelas-preco";

export interface EstadoSelecaoTabela {
  erro: string | null;
  sucesso: string | null;
}

export const ESTADO_SELECAO_TABELA_INICIAL: EstadoSelecaoTabela = { erro: null, sucesso: null };

// "Pegue apenas a tabela 110, o sync das outras só vai acontecer se ela
// for selecionada" (pedido do usuário) - a seleção acontece ANTES do
// sync, não depois (diferente do fluxo anterior de "definir padrão" entre
// tabelas já sincronizadas). Só admin (backend valida via
// requireRole('admin'), ver admin-tabelas-preco.controller.ts). Não
// dispara sync sozinho - depois de selecionar, o admin roda "Executar
// agora" pra 'tabela-preco' na tela de Sincronização (/admin/sincronizacao,
// já existente).
export async function selecionarTabelaPreco(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _estadoAnterior: EstadoSelecaoTabela,
  formData: FormData,
): Promise<EstadoSelecaoTabela> {
  const codigo = String(formData.get("codigo") ?? "").trim();
  if (!codigo) {
    return { erro: "Informe o código da tabela.", sucesso: null };
  }

  try {
    await apiFetch<ConfiguracaoTabelaPrecoDto>("/admin/tabelas-preco/configuracao", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo }),
      cache: "no-store",
    });
  } catch (error) {
    return {
      erro: error instanceof ApiError ? error.message : "Erro desconhecido ao selecionar a tabela.",
      sucesso: null,
    };
  }

  revalidatePath("/tabelas-preco");
  return {
    erro: null,
    sucesso: `Tabela "${codigo}" selecionada. Vá em Sincronização e clique em "Executar agora" pra buscar os dados.`,
  };
}
