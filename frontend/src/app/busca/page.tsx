import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { BuscaResultadoDto } from "@/lib/busca";
import { configSituacaoPedido } from "@/lib/pedidos";
import { rotuloTipoProduto } from "@/lib/produtos";
import { formatarData, formatarMoeda } from "@/lib/formatacao";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { Badge, BadgeAtivoInativo } from "@/components/badge";
import { ListItem } from "@/components/design/list-item";

// Tela de resultado da busca global da Topbar (GET /busca, OS-BACKEND-18) -
// o campo já existia visualmente há tempo, mas `disabled` (sem tela de
// resultado no web ainda) - só dado real já sincronizado, os mesmos 3
// tipos que o endpoint já busca (cliente/produto/pedido), sem paginação
// própria (o endpoint não pagina, devolve tudo que bater com `q`).
export default async function BuscaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await exigirUsuarioAutenticado("/busca");
  const { q } = await searchParams;
  const termo = q?.trim() || undefined;

  let resultado: BuscaResultadoDto | null = null;
  let erro: string | null = null;

  if (termo) {
    try {
      resultado = await apiFetch<BuscaResultadoDto>(`/busca?q=${encodeURIComponent(termo)}`, {
        cache: "no-store",
      });
    } catch (error) {
      erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
    }
  }

  const totalResultados =
    (resultado?.clientes.length ?? 0) + (resultado?.produtos.length ?? 0) + (resultado?.pedidos.length ?? 0);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">
        {termo ? `Resultados para "${termo}"` : "Buscar"}
      </h1>

      {!termo ? (
        <EstadoVazio mensagem="Digite algo na busca, no topo da tela, pra ver resultados de cliente, produto e pedido." />
      ) : erro ? (
        <ErroConexao mensagem={erro} />
      ) : totalResultados === 0 ? (
        <EstadoVazio mensagem="Nenhum cliente, produto ou pedido encontrado." />
      ) : (
        resultado && (
          <>
            {resultado.clientes.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-ink">
                  Clientes ({resultado.clientes.length})
                </h2>
                <div className="flex flex-col gap-3">
                  {resultado.clientes.map((cliente) => {
                    const titulo = cliente.razaoSocial ?? cliente.nomeFantasia ?? "—";
                    return (
                      <ListItem
                        key={cliente.id}
                        href={`/clientes/${cliente.id}`}
                        avatar={titulo.charAt(0).toUpperCase()}
                        titulo={titulo}
                        subtitulo={cliente.cpfCnpj ?? "Sem CPF/CNPJ"}
                        tag={<BadgeAtivoInativo inativo={cliente.inativo} />}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {resultado.produtos.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-ink">
                  Produtos ({resultado.produtos.length})
                </h2>
                <div className="flex flex-col gap-3">
                  {resultado.produtos.map((produto) => {
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
              </section>
            )}

            {resultado.pedidos.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-ink">
                  Pedidos ({resultado.pedidos.length})
                </h2>
                <div className="flex flex-col gap-3">
                  {resultado.pedidos.map((pedido) => {
                    const situacaoConfig = configSituacaoPedido(pedido.situacao);
                    const titulo = pedido.cliente?.razaoSocial ?? "Cliente não identificado";
                    return (
                      <ListItem
                        key={pedido.id}
                        href={`/pedidos/${pedido.id}`}
                        avatar={titulo.charAt(0).toUpperCase()}
                        titulo={titulo}
                        subtitulo={`Pedido ${pedido.numero ?? "—"} · ${formatarData(pedido.dataHoraUltimaAlteracao)}`}
                        valor={formatarMoeda(pedido.valorTotal)}
                        tag={<Badge enfase={situacaoConfig.enfase}>{situacaoConfig.rotulo}</Badge>}
                      />
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )
      )}
    </main>
  );
}
