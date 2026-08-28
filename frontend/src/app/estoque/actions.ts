"use server";

import { apiFetch, ApiError } from "@/lib/api";
import type { EstoqueConsultaDto } from "@/lib/estoque";

// Estado retornado pelo useActionState no Client Component (busca-estoque.tsx)
// - discriminado por `status`, um por resultado possível da consulta (ver
// skill wk-radar-bi-client: produto não encontrado, encontrado sem saldo, e
// encontrado com saldo são três coisas diferentes, tratadas separadamente).
export type ResultadoConsultaEstoque =
  | { status: "idle" }
  | { status: "nao-encontrado"; identificador: string }
  | { status: "sem-saldo"; identificador: string }
  | { status: "com-saldo"; identificador: string; resultado: EstoqueConsultaDto }
  | { status: "erro"; mensagem: string };

export async function consultarEstoque(
  _estadoAnterior: ResultadoConsultaEstoque,
  formData: FormData,
): Promise<ResultadoConsultaEstoque> {
  const identificador = String(formData.get("identificador") ?? "").trim();

  if (!identificador) {
    return { status: "erro", mensagem: "Informe um código ou ID de produto." };
  }

  try {
    const resultado = await apiFetch<EstoqueConsultaDto>(
      `/estoque/${encodeURIComponent(identificador)}`,
      { cache: "no-store" },
    );

    // Estoque.svc (fonte atual, ver comentário em lib/estoque.ts) retorna
    // saldo CONSOLIDADO por produto - um item com quantidade "0" ainda
    // conta como item (linha existe no banco), mas pro usuário isso é
    // exatamente "sem saldo", não uma localização com saldo zerado.
    const temSaldoReal = resultado.itens.some((item) => Number(item.quantidade) > 0);

    return !temSaldoReal
      ? { status: "sem-saldo", identificador }
      : { status: "com-saldo", identificador, resultado };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { status: "nao-encontrado", identificador };
    }
    return {
      status: "erro",
      mensagem: error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.",
    };
  }
}
