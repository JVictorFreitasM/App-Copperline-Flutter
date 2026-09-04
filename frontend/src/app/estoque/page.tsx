import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { ProdutoMaisPedidoDto } from "@/lib/estoque";
import { ListItem } from "@/components/design/list-item";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { BuscaEstoque } from "./busca-estoque";

// Quarta tela de negocio (OS-WEB-14) - unica que nao e uma listagem
// paginada de dado sincronizado, e sim uma busca pontual em tempo real
// (endpoint on-demand da OS-BACKEND-12). Server Component so pra garantir
// autenticacao antes de renderizar (mesmo padrao das telas anteriores) - a
// interacao de busca em si vive no Client Component BuscaEstoque.
// `identificador` (query string) permite chegar aqui com um codigo ja
// preenchido - usado pelo atalho "Ver estoque" na tela de detalhe do
// produto, pra nao precisar digitar o codigo de novo.
export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ identificador?: string }>;
}) {
  await exigirUsuarioAutenticado("/estoque");

  const { identificador } = await searchParams;

  let maisPedidos: ProdutoMaisPedidoDto[] | null = null;
  let erroMaisPedidos: string | null = null;
  try {
    maisPedidos = await apiFetch<ProdutoMaisPedidoDto[]>("/estoque/mais-pedidos", {
      cache: "no-store",
    });
  } catch (error) {
    erroMaisPedidos = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Consulta de estoque</h1>
      <BuscaEstoque identificadorInicial={identificador} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Produtos mais pedidos</h2>
        {!maisPedidos ? (
          <ErroConexao mensagem={erroMaisPedidos!} />
        ) : maisPedidos.length === 0 ? (
          <EstadoVazio mensagem="Nenhum produto com pedido registrado ainda." />
        ) : (
          <div className="flex flex-col gap-3">
            {maisPedidos.map((produto) => (
              <ListItem
                key={produto.produtoId}
                href={`/produtos/${produto.produtoId}`}
                titulo={produto.nome ?? produto.codigo}
                subtitulo={`Código ${produto.codigo} · ${produto.quantidadeTotalPedida} unidade(s) pedida(s)`}
                valor={
                  produto.quantidadeDisponivel !== null
                    ? `${produto.quantidadeDisponivel} em estoque`
                    : "Sem saldo sincronizado"
                }
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
