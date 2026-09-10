import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { ItemTabelaPrecoDto, TabelaPrecoResumoDto } from "@/lib/tabelas-preco";
import type { PaginatedResult } from "@/lib/pagination";
import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/formatacao";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { Badge, BadgeAtivoInativo } from "@/components/badge";
import { Card } from "@/components/design/card";
import { ListItem } from "@/components/design/list-item";
import { Paginacao } from "@/components/paginacao";

const LIMITE_POR_PAGINA = 30;

export default async function TabelaPrecoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  await exigirUsuarioAutenticado("/tabelas-preco");

  const { id } = await params;
  const { page } = await searchParams;
  const paginaParam = Number(page);
  const pagina = Number.isInteger(paginaParam) && paginaParam > 0 ? paginaParam : 1;

  let tabela: TabelaPrecoResumoDto | null = null;
  let itens: PaginatedResult<ItemTabelaPrecoDto> | null = null;
  let naoEncontrada = false;
  let erro: string | null = null;

  try {
    [tabela, itens] = await Promise.all([
      apiFetch<TabelaPrecoResumoDto>(`/tabelas-preco/${encodeURIComponent(id)}`, {
        cache: "no-store",
      }),
      apiFetch<PaginatedResult<ItemTabelaPrecoDto>>(
        `/tabelas-preco/${encodeURIComponent(id)}/itens?page=${pagina}&limit=${LIMITE_POR_PAGINA}`,
        { cache: "no-store" },
      ),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      naoEncontrada = true;
    } else {
      erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <Link href="/tabelas-preco" className="text-sm font-medium text-primary hover:underline">
        ← Voltar para tabelas de preço
      </Link>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : naoEncontrada ? (
        <EstadoVazio mensagem={`Tabela de preço '${id}' não encontrada.`} />
      ) : (
        tabela &&
        itens && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-ink">Tabela {tabela.codigo}</h1>
                <BadgeAtivoInativo inativo={!tabela.ativa} />
              </div>
            </div>

            <Card className="text-sm text-ink">
              <p className="text-xs text-muted">
                {tabela.quantidadeItens} item(ns) · sincronizada em{" "}
                {formatarDataHora(tabela.sincronizadoEm)}
              </p>
            </Card>

            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-ink">Itens</h2>
              {itens.data.length === 0 ? (
                <EstadoVazio mensagem="Nenhum item nesta tabela." />
              ) : (
                <div className="flex flex-col gap-3">
                  {itens.data.map((item) => (
                    <ListItem
                      key={item.id}
                      titulo={`Código ${item.codigoItem}`}
                      subtitulo={
                        item.dataUltimoReajuste
                          ? `Último reajuste em ${formatarData(item.dataUltimoReajuste)}`
                          : undefined
                      }
                      valor={formatarMoeda(item.preco)}
                      tag={
                        item.precoPromocional && Number(item.precoPromocional) > 0 ? (
                          <Badge enfase>Promo: {formatarMoeda(item.precoPromocional)}</Badge>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              )}

              <Paginacao
                rota={`/tabelas-preco/${tabela.id}`}
                pagina={itens.meta.page}
                totalPaginas={itens.meta.totalPages}
              />
            </section>
          </>
        )
      )}
    </main>
  );
}
