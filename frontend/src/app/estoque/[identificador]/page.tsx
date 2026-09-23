import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { EstoqueConsultaDto } from "@/lib/estoque";
import { EstadoVazio, ErroConexao } from "@/components/listagem-feedback";
import { EstoqueResultadoView } from "../estoque-resultado-view";

// Tela DEDICADA de estoque de um produto específico (pedido do usuário,
// 2026-09-23) - separada da tela de busca geral (/estoque, com o campo de
// busca solto e "produtos mais pedidos"). Chegada aqui só pelo botão "Ver
// estoque" (tela de detalhe do produto) ou pelo item da lista de mais
// pedidos (/estoque) - nunca via busca manual, que continua vivendo em
// /estoque mesmo (BuscaEstoque).
export default async function EstoqueProdutoPage({
  params,
}: {
  params: Promise<{ identificador: string }>;
}) {
  await exigirUsuarioAutenticado("/estoque");

  const { identificador } = await params;

  let resultado: EstoqueConsultaDto | null = null;
  let naoEncontrado = false;
  let erro: string | null = null;

  try {
    resultado = await apiFetch<EstoqueConsultaDto>(
      `/estoque/${encodeURIComponent(identificador)}`,
      { cache: "no-store" },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      naoEncontrado = true;
    } else {
      erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <Link href="/estoque" className="text-sm font-medium text-primary hover:underline">
        ← Voltar para estoque
      </Link>

      <h1 className="text-2xl font-bold text-ink">
        Estoque · {resultado?.codigo ?? identificador}
      </h1>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : naoEncontrado ? (
        <EstadoVazio mensagem={`Produto '${identificador}' não encontrado.`} />
      ) : (
        resultado && <EstoqueResultadoView resultado={resultado} />
      )}
    </main>
  );
}
