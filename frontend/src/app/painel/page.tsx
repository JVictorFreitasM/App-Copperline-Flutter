import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type {
  EstoqueCriticoDashboardDto,
  NotasFiscaisDashboardDto,
  RankingDashboardDto,
  ResumoDashboardDto,
  VendasDashboardDto,
} from "@/lib/dashboard";
import { formatarData, formatarMoeda } from "@/lib/formatacao";
import { configSituacaoPedido } from "@/lib/pedidos";
import { clienteDaNotaFiscal, configStatusNfe, rotuloTipoNotaFiscal } from "@/lib/notas-fiscais";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { ListItem } from "@/components/design/list-item";
import { Card } from "@/components/design/card";
import { Badge } from "@/components/badge";
import { FiltroForm, CampoFiltro } from "@/components/filtro";
import { GraficoBarras } from "@/components/design/grafico-barras";
import { DonutKpiCard } from "@/components/design/donut-kpi-card";
import { GaugeCard } from "@/components/design/gauge-card";
import { PainelResumo } from "@/components/design/painel-resumo";
import { EventoCard } from "@/components/design/evento-card";
import { IconeClipboard, IconeRecibo } from "@/components/design/icons";

// Tela de resumo (dashboard) - substitui a antiga /painel (que so mostrava
// dados do usuario logado, sem funcao real - ver historico da OS 10).
// Expandida na OS-WEB-19 com os gráficos de OS-BACKEND-17 (vendas, ranking,
// notas fiscais, estoque crítico) e um filtro de período global. Redesenho
// visual (ver skill design-system, referência "Constructive") - mesmos
// dados/endpoints de sempre, só reapresentados como anéis de KPI/medidor/
// cards de evento em vez de stat cards simples - nenhum dado novo
// inventado, só reagrupamento visual do que já era buscado aqui.
//
// Filtro por querystring nativa (FiltroForm, method="get") - reflete em
// TODOS os gráficos porque são a mesma renderização server-side, disparada
// pela troca de searchParams (sem precisar de nenhum Client Component pro
// filtro em si, ver critério de aceite "mudar o filtro atualiza todos os
// gráficos"). GET /dashboard/estoque-critico não aceita período (não tem
// esse conceito - é o saldo ATUAL cruzado com pedido pendente, não um
// histórico), por isso não recebe a querystring do filtro.
export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ dataInicial?: string; dataFinal?: string }>;
}) {
  await exigirUsuarioAutenticado("/painel");
  const { dataInicial, dataFinal } = await searchParams;

  const queryPeriodo = new URLSearchParams({
    ...(dataInicial && { dataInicial }),
    ...(dataFinal && { dataFinal }),
  }).toString();

  // OS-WEB-29: cada secao busca seu proprio dado de forma independente
  // (Promise.allSettled, nao Promise.all) - uma falha isolada num unico
  // endpoint nao derruba o painel inteiro, so a secao afetada mostra sua
  // propria mensagem de erro.
  const [resumoResultado, vendasResultado, rankingResultado, notasFiscaisResultado, estoqueCriticoResultado] =
    await Promise.allSettled([
      apiFetch<ResumoDashboardDto>("/dashboard/resumo", { cache: "no-store" }),
      apiFetch<VendasDashboardDto>(`/dashboard/vendas?${queryPeriodo}`, { cache: "no-store" }),
      apiFetch<RankingDashboardDto>(`/dashboard/ranking?${queryPeriodo}`, { cache: "no-store" }),
      apiFetch<NotasFiscaisDashboardDto>(`/dashboard/notas-fiscais?${queryPeriodo}`, {
        cache: "no-store",
      }),
      apiFetch<EstoqueCriticoDashboardDto>("/dashboard/estoque-critico", { cache: "no-store" }),
    ]);

  function extrair<T>(resultado: PromiseSettledResult<T>): [T | null, string | null] {
    if (resultado.status === "fulfilled") {
      return [resultado.value, null];
    }
    const erro = resultado.reason;
    return [null, erro instanceof ApiError ? erro.message : "Erro desconhecido ao consultar a API."];
  }

  const [resumo, erroResumo] = extrair(resumoResultado);
  const [vendas, erroVendas] = extrair(vendasResultado);
  const [ranking, erroRanking] = extrair(rankingResultado);
  const [notasFiscais, erroNotasFiscais] = extrair(notasFiscaisResultado);
  const [estoqueCritico, erroEstoqueCritico] = extrair(estoqueCriticoResultado);

  // Percentuais derivados pros anéis de KPI/medidor - sempre a partir do
  // MESMO dado já buscado acima, nunca um número novo/estimado.
  const totalPedidos = vendas?.totalPedidos ?? 0;
  const pedidosFaturados =
    vendas?.contagemPorSituacao.find((item) => item.situacao === "FATURADO")?.quantidade ?? 0;
  const percentualFaturado = totalPedidos > 0 ? (pedidosFaturados / totalPedidos) * 100 : 0;

  const totalNotas = notasFiscais?.contagemPorStatus.reduce((soma, item) => soma + item.quantidade, 0) ?? 0;
  const notasAutorizadas =
    notasFiscais?.contagemPorStatus.find((item) => item.status === "AUTORIZADA")?.quantidade ?? 0;
  const percentualAutorizadas = totalNotas > 0 ? (notasAutorizadas / totalNotas) * 100 : 0;

  const produtosAtivos = resumo?.produtosAtivos ?? 0;
  const produtosCriticos = estoqueCritico?.produtos.length ?? 0;
  const percentualCritico = produtosAtivos > 0 ? (produtosCriticos / produtosAtivos) * 100 : 0;
  const saudeEstoque = 100 - percentualCritico;

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Painel</h1>

      <FiltroForm rota="/painel">
        <CampoFiltro label="De" name="dataInicial" defaultValue={dataInicial} type="date" />
        <CampoFiltro label="Até" name="dataFinal" defaultValue={dataFinal} type="date" />
      </FiltroForm>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {vendas ? (
          <DonutKpiCard
            titulo="Pedidos faturados"
            percentual={percentualFaturado}
            valor={String(totalPedidos)}
            cor="primary"
            href="/pedidos"
          />
        ) : (
          <Card>
            <ErroConexao mensagem={erroVendas!} />
          </Card>
        )}

        {notasFiscais ? (
          <DonutKpiCard
            titulo="Notas autorizadas"
            percentual={percentualAutorizadas}
            valor={String(totalNotas)}
            cor="laranja"
            href="/notas-fiscais"
          />
        ) : (
          <Card>
            <ErroConexao mensagem={erroNotasFiscais!} />
          </Card>
        )}

        {estoqueCritico && resumo ? (
          <DonutKpiCard
            titulo="Estoque crítico"
            percentual={percentualCritico}
            valor={String(produtosCriticos)}
            cor="vermelho"
            href="/estoque"
          />
        ) : (
          <Card>
            <ErroConexao mensagem={(erroEstoqueCritico ?? erroResumo)!} />
          </Card>
        )}

        {resumo ? (
          <PainelResumo
            itens={[
              { rotulo: "Clientes ativos", valor: resumo.clientesAtivos, cor: "primary" },
              { rotulo: "Produtos ativos", valor: resumo.produtosAtivos, cor: "verde" },
              { rotulo: "Pedidos em aberto", valor: resumo.pedidosEmAberto, cor: "laranja" },
            ]}
          />
        ) : (
          <Card>
            <ErroConexao mensagem={erroResumo!} />
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-ink">Vendas por situação</h2>
            {vendas && (
              <p className="text-sm text-muted">
                {vendas.totalPedidos} pedido(s) · {formatarMoeda(vendas.valorTotal)} · ticket médio{" "}
                {formatarMoeda(vendas.ticketMedio)}
              </p>
            )}
          </div>
          {!vendas ? (
            <ErroConexao mensagem={erroVendas!} />
          ) : vendas.contagemPorSituacao.length === 0 ? (
            <EstadoVazio mensagem="Nenhum pedido no período selecionado." />
          ) : (
            <GraficoBarras
              dados={vendas.contagemPorSituacao.map((item) => ({
                rotulo: configSituacaoPedido(item.situacao).rotulo,
                valor: item.quantidade,
              }))}
            />
          )}
        </Card>

        {estoqueCritico && resumo ? (
          <GaugeCard
            percentual={saudeEstoque}
            legendaVerde={{ rotulo: "OK", valor: String(produtosAtivos - produtosCriticos) }}
            legendaVermelha={{ rotulo: "Crítico", valor: String(produtosCriticos) }}
          />
        ) : (
          <Card>
            <ErroConexao mensagem={(erroEstoqueCritico ?? erroResumo)!} />
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-ink">Notas fiscais por status</h2>
            {notasFiscais && (
              <p className="text-sm text-muted">
                Faturado no período: {formatarMoeda(notasFiscais.valorFaturado)}
              </p>
            )}
          </div>
          {!notasFiscais ? (
            <ErroConexao mensagem={erroNotasFiscais!} />
          ) : notasFiscais.contagemPorStatus.length === 0 ? (
            <EstadoVazio mensagem="Nenhuma nota fiscal no período selecionado." />
          ) : (
            <GraficoBarras
              dados={notasFiscais.contagemPorStatus.map((item) => ({
                rotulo: configStatusNfe(item.status).rotulo,
                valor: item.quantidade,
              }))}
            />
          )}
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <h2 className="mb-1 text-lg font-semibold text-ink">Top clientes</h2>
            {!ranking ? (
              <ErroConexao mensagem={erroRanking!} />
            ) : ranking.topClientes.length === 0 ? (
              <EstadoVazio mensagem="Nenhum cliente com pedido no período selecionado." />
            ) : (
              <GraficoBarras
                dados={ranking.topClientes.map((item) => ({
                  rotulo: item.nome,
                  valor: Number(item.valorTotal),
                }))}
                formato="moeda"
              />
            )}
          </Card>

          <Card>
            <h2 className="mb-1 text-lg font-semibold text-ink">Top produtos</h2>
            {!ranking ? (
              <ErroConexao mensagem={erroRanking!} />
            ) : ranking.topProdutos.length === 0 ? (
              <EstadoVazio mensagem="Nenhum produto com pedido no período selecionado." />
            ) : (
              <GraficoBarras
                dados={ranking.topProdutos.map((item) => ({
                  rotulo: item.nome,
                  valor: Number(item.valorTotal),
                }))}
                formato="moeda"
              />
            )}
          </Card>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Eventos recentes</h2>
        {!resumo ? (
          <ErroConexao mensagem={erroResumo!} />
        ) : resumo.pedidosRecentes.length === 0 && resumo.notasFiscaisRecentes.length === 0 ? (
          <EstadoVazio mensagem="Nenhum evento recente." />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {resumo.pedidosRecentes.map((pedido) => {
              const situacao = configSituacaoPedido(pedido.situacao);
              const titulo = pedido.cliente?.razaoSocial ?? "Cliente não identificado";
              return (
                <EventoCard
                  key={`pedido-${pedido.id}`}
                  icone={<IconeClipboard />}
                  corIcone={situacao.enfase ? "primary" : "laranja"}
                  titulo={`Pedido ${pedido.numero ?? "—"}`}
                  descricao={`${titulo} · ${situacao.rotulo} · ${formatarMoeda(pedido.valorTotal)}`}
                  horario={formatarData(pedido.dataHoraUltimaAlteracao)}
                  acaoRotulo="Ver pedido"
                  acaoHref={`/pedidos/${pedido.id}`}
                />
              );
            })}
            {resumo.notasFiscaisRecentes.map((nota) => {
              const status = configStatusNfe(nota.statusNfe);
              const titulo = `Nota ${nota.numero ?? "—"}${nota.serie ? `/${nota.serie}` : ""}`;
              return (
                <EventoCard
                  key={`nota-${nota.id}`}
                  icone={<IconeRecibo />}
                  corIcone={status.enfase ? "primary" : "vermelho"}
                  titulo={titulo}
                  descricao={`${clienteDaNotaFiscal(nota)} · ${status.rotulo} · ${rotuloTipoNotaFiscal(nota.tipo)}`}
                  horario={formatarData(nota.dataEmissao)}
                  acaoRotulo="Ver notas"
                  acaoHref="/notas-fiscais"
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">
          Estoque crítico{estoqueCritico ? ` (${estoqueCritico.produtos.length})` : ""}
        </h2>
        {!estoqueCritico ? (
          <ErroConexao mensagem={erroEstoqueCritico!} />
        ) : estoqueCritico.produtos.length === 0 ? (
          <EstadoVazio mensagem="Nenhum produto com estoque crítico e pedido pendente no momento." />
        ) : (
          <div className="flex flex-col gap-3">
            {estoqueCritico.produtos.map((produto) => (
              <ListItem
                key={produto.produtoId}
                href={`/produtos/${produto.produtoId}`}
                titulo={produto.nome ?? produto.codigo}
                subtitulo={`Código ${produto.codigo} · ${produto.quantidadePedidosPendentes} pedido(s) pendente(s)`}
                valor={`${produto.quantidadeDisponivel} disponível`}
                tag={<Badge enfase>Crítico</Badge>}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
