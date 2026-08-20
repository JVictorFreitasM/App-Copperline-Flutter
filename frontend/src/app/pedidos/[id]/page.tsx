import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { configSituacaoPedido, type PedidoDetalheDto } from "@/lib/pedidos";
import { formatarData, formatarMoeda } from "@/lib/formatacao";
import { EstadoVazio, ErroConexao } from "@/components/listagem-feedback";
import { Badge } from "@/components/badge";
import { Card } from "@/components/design/card";
import { ListItem } from "@/components/design/list-item";

// Tela de detalhe do pedido (OS-WEB-15) - mostra os itens, que a listagem
// não mostrava (árvore fiscal completa fica de fora, só um subconjunto
// útil: produto, quantidade, valores, situação do item). Só leitura.
// Retrofit visual (OS-WEB-16): valor total vira o número em destaque da
// tela, itens viram ListItem em vez de tabela de 6 colunas.
export default async function PedidoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirUsuarioAutenticado("/pedidos");

  const { id } = await params;

  let pedido: PedidoDetalheDto | null = null;
  let naoEncontrado = false;
  let erro: string | null = null;

  try {
    pedido = await apiFetch<PedidoDetalheDto>(`/pedidos/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      naoEncontrado = true;
    } else {
      erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <Link href="/pedidos" className="text-sm font-medium text-primary hover:underline">
        ← Voltar para pedidos
      </Link>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : naoEncontrado ? (
        <EstadoVazio mensagem={`Pedido '${id}' não encontrado.`} />
      ) : (
        pedido && (
          <>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-ink">Pedido {pedido.numero ?? "—"}</h1>
              <Badge enfase={configSituacaoPedido(pedido.situacao).enfase}>
                {configSituacaoPedido(pedido.situacao).rotulo}
              </Badge>
            </div>

            <Card>
              <p className="text-xs text-muted">Valor total</p>
              <p className="text-4xl font-bold text-ink">{formatarMoeda(pedido.valorTotal)}</p>
            </Card>

            <Card className="grid grid-cols-1 gap-4 text-sm text-ink sm:grid-cols-2">
              <p>
                <span className="font-medium">Cliente:</span>{" "}
                {pedido.cliente ? (
                  <Link
                    href={`/clientes/${pedido.cliente.id}`}
                    className="text-primary hover:underline"
                  >
                    {pedido.cliente.razaoSocial ?? "—"}
                  </Link>
                ) : (
                  "—"
                )}
              </p>
              <p>
                <span className="font-medium">Última alteração:</span>{" "}
                {formatarData(pedido.dataHoraUltimaAlteracao)}
              </p>
            </Card>

            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-ink">Itens</h2>
              {pedido.itens.length === 0 ? (
                <EstadoVazio mensagem="Nenhum item neste pedido." />
              ) : (
                <div className="flex flex-col gap-3">
                  {pedido.itens.map((item) => {
                    const situacaoItem = configSituacaoPedido(item.situacao);
                    const titulo = item.produto?.nome ?? item.produto?.codigo ?? "—";
                    return (
                      <ListItem
                        key={item.id}
                        href={item.produto ? `/produtos/${item.produto.id}` : undefined}
                        avatar={String(item.numero)}
                        titulo={titulo}
                        subtitulo={`${item.quantidadeVenda ?? "—"} × ${formatarMoeda(item.valorUnitario)}`}
                        valor={formatarMoeda(item.valorTotal)}
                        tag={<Badge enfase={situacaoItem.enfase}>{situacaoItem.rotulo}</Badge>}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )
      )}
    </main>
  );
}
