import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { rotuloTipoProduto, type ProdutoResumoDto } from "@/lib/produtos";
import { formatarMoeda } from "@/lib/formatacao";
import type { PaginatedResult } from "@/lib/pagination";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { Paginacao } from "@/components/paginacao";
import { BadgeAtivoInativo } from "@/components/badge";
import { FiltroForm, CampoFiltro } from "@/components/filtro";
import { ListItem } from "@/components/design/list-item";

const LIMITE_POR_PAGINA = 20;

// Segunda tela de negocio (OS-WEB-12) - consome GET /produtos
// (OS-BACKEND-11), reaproveitando o mesmo padrao da pagina de clientes
// (OS-WEB-11). Filtro (nome/código/GTIN) e link pro detalhe adicionados na
// OS-WEB-15 - filtro de GTIN exigiu estender ListarProdutosQueryDto no
// backend, que não aceitava esse campo antes. Retrofit visual (OS-WEB-16):
// tabela virou lista de ListItem, mesmo dado.
export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; nome?: string; codigo?: string; gtin?: string }>;
}) {
  await exigirUsuarioAutenticado("/produtos");

  const params = await searchParams;
  const paginaParam = Number(params.page);
  const pagina = Number.isInteger(paginaParam) && paginaParam > 0 ? paginaParam : 1;
  const nome = params.nome?.trim() || undefined;
  const codigo = params.codigo?.trim() || undefined;
  const gtin = params.gtin?.trim() || undefined;

  let resultado: PaginatedResult<ProdutoResumoDto> | null = null;
  let erro: string | null = null;

  try {
    const query = new URLSearchParams({
      page: String(pagina),
      limit: String(LIMITE_POR_PAGINA),
      ...(nome && { nome }),
      ...(codigo && { codigo }),
      ...(gtin && { gtin }),
    });
    resultado = await apiFetch<PaginatedResult<ProdutoResumoDto>>(`/produtos?${query}`, {
      cache: "no-store",
    });
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Produtos</h1>

      <FiltroForm rota="/produtos">
        <CampoFiltro label="Nome" name="nome" defaultValue={nome} />
        <CampoFiltro label="Código" name="codigo" defaultValue={codigo} />
        <CampoFiltro label="GTIN" name="gtin" defaultValue={gtin} />
      </FiltroForm>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : resultado && resultado.data.length === 0 ? (
        <EstadoVazio mensagem="Nenhum produto encontrado." />
      ) : (
        resultado && (
          <>
            <div className="flex flex-col gap-3">
              {resultado.data.map((produto) => {
                const titulo = produto.nome ?? produto.codigo ?? "—";
                return (
                  <ListItem
                    key={produto.id}
                    href={`/produtos/${produto.id}`}
                    avatar={titulo.charAt(0).toUpperCase()}
                    titulo={titulo}
                    subtitulo={`${produto.codigo ?? "—"} · ${rotuloTipoProduto(produto.tipo)}`}
                    valor={formatarMoeda(produto.precoVenda)}
                    tag={<BadgeAtivoInativo inativo={produto.inativo} />}
                  />
                );
              })}
            </div>

            <Paginacao
              rota="/produtos"
              pagina={resultado.meta.page}
              totalPaginas={resultado.meta.totalPages}
              filtros={{ nome, codigo, gtin }}
            />
          </>
        )
      )}
    </main>
  );
}
