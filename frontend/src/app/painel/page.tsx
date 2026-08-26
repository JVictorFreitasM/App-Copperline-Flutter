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
import { StatCard } from "@/components/design/stat-card";
import { ListItem } from "@/components/design/list-item";
import { Card } from "@/components/design/card";
import { Badge } from "@/components/badge";
import { PrimaryButton, SecondaryButton } from "@/components/design/button";
import { FiltroForm, CampoFiltro } from "@/components/filtro";
import { GraficoBarras } from "@/components/design/grafico-barras";
import { IconeCaixa, IconeClipboard, IconeMoeda, IconePessoas } from "@/components/design/icons";

// Tela de resumo (dashboard) - substitui a antiga /painel (que so mostrava
// dados do usuario logado, sem funcao real - ver historico da OS 10).
// Expandida na OS-WEB-19 com os gráficos de OS-BACKEND-17 (vendas, ranking,
// notas fiscais, estoque crítico) e um filtro de período global - a rota
// já existia (GET /dashboard/resumo, sem período), então o resumo/stat
// cards do topo continuam iguais, só as seções novas abaixo respeitam
// dataInicial/dataFinal.
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
  const user = await exigirUsuarioAutenticado("/painel");
  const { dataInicial, dataFinal } = await searchParams;

  const queryPeriodo = new URLSearchParams({
    ...(dataInicial && { dataInicial }),
    ...(dataFinal && { dataFinal }),
  }).toString();

  let resumo: ResumoDashboardDto | null = null;
  let vendas: VendasDashboardDto | null = null;
  let ranking: RankingDashboardDto | null = null;
  let notasFiscais: NotasFiscaisDashboardDto | null = null;
  let estoqueCritico: EstoqueCriticoDashboardDto | null = null;
  let erro: string | null = null;

  try {
    [resumo, vendas, ranking, notasFiscais, estoqueCritico] = await Promise.all([
      apiFetch<ResumoDashboardDto>("/dashboard/resumo", { cache: "no-store" }),
      apiFetch<VendasDashboardDto>(`/dashboard/vendas?${queryPeriodo}`, { cache: "no-store" }),
      apiFetch<RankingDashboardDto>(`/dashboard/ranking?${queryPeriodo}`, { cache: "no-store" }),
      apiFetch<NotasFiscaisDashboardDto>(`/dashboard/notas-fiscais?${queryPeriodo}`, {
        cache: "no-store",
      }),
      apiFetch<EstoqueCriticoDashboardDto>("/dashboard/estoque-critico", { cache: "no-store" }),
    ]);
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Olá, {user.name}</h1>

      <div className="flex flex-wrap gap-3">
        <PrimaryButton href="/clientes">Clientes</PrimaryButton>
        <SecondaryButton href="/produtos">Produtos</SecondaryButton>
        <SecondaryButton href="/pedidos">Pedidos</SecondaryButton>
        <SecondaryButton href="/estoque">Estoque</SecondaryButton>
        <SecondaryButton href="/notas-fiscais">Notas fiscais</SecondaryButton>
      </div>

      <FiltroForm rota="/painel">
        <CampoFiltro label="De" name="dataInicial" defaultValue={dataInicial} type="date" />
        <CampoFiltro label="Até" name="dataFinal" defaultValue={dataFinal} type="date" />
      </FiltroForm>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : (
        resumo &&
        vendas &&
        ranking &&
        notasFiscais &&
        estoqueCritico && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                icon={<IconePessoas />}
                label="Clientes ativos"
                value={resumo.clientesAtivos}
              />
              <StatCard
                icon={<IconeCaixa />}
                label="Produtos ativos"
                value={resumo.produtosAtivos}
              />
              <StatCard
                icon={<IconeClipboard />}
                label="Pedidos em aberto"
                value={resumo.pedidosEmAberto}
              />
              <StatCard
                icon={<IconeMoeda />}
                label={`Faturado (${resumo.periodoValorFaturadoDias}d)`}
                value={formatarMoeda(resumo.valorFaturadoRecente)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <div className="mb-1 flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold text-ink">Vendas por situação</h2>
                  <p className="text-sm text-muted">
                    {vendas.totalPedidos} pedido(s) · {formatarMoeda(vendas.valorTotal)} · ticket
                    médio {formatarMoeda(vendas.ticketMedio)}
                  </p>
                </div>
                {vendas.contagemPorSituacao.length === 0 ? (
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

              <Card>
                <div className="mb-1 flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold text-ink">Notas fiscais por status</h2>
                  <p className="text-sm text-muted">
                    Faturado no período: {formatarMoeda(notasFiscais.valorFaturado)}
                  </p>
                </div>
                {notasFiscais.contagemPorStatus.length === 0 ? (
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

              <Card>
                <h2 className="mb-1 text-lg font-semibold text-ink">Top clientes</h2>
                {ranking.topClientes.length === 0 ? (
                  <EstadoVazio mensagem="Nenhum cliente com pedido no período selecionado." />
                ) : (
                  <GraficoBarras
                    dados={ranking.topClientes.map((item) => ({
                      rotulo: item.nome,
                      valor: Number(item.valorTotal),
                    }))}
                    formatarValor={(valor) => formatarMoeda(String(valor))}
                  />
                )}
              </Card>

              <Card>
                <h2 className="mb-1 text-lg font-semibold text-ink">Top produtos</h2>
                {ranking.topProdutos.length === 0 ? (
                  <EstadoVazio mensagem="Nenhum produto com pedido no período selecionado." />
                ) : (
                  <GraficoBarras
                    dados={ranking.topProdutos.map((item) => ({
                      rotulo: item.nome,
                      valor: Number(item.valorTotal),
                    }))}
                    formatarValor={(valor) => formatarMoeda(String(valor))}
                  />
                )}
              </Card>
            </div>

            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-ink">
                Estoque crítico ({estoqueCritico.produtos.length})
              </h2>
              {estoqueCritico.produtos.length === 0 ? (
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

            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-ink">Pedidos recentes</h2>
              {resumo.pedidosRecentes.length === 0 ? (
                <EstadoVazio mensagem="Nenhum pedido sincronizado ainda." />
              ) : (
                <div className="flex flex-col gap-3">
                  {resumo.pedidosRecentes.map((pedido) => {
                    const situacao = configSituacaoPedido(pedido.situacao);
                    const titulo = pedido.cliente?.razaoSocial ?? "Cliente não identificado";
                    return (
                      <ListItem
                        key={pedido.id}
                        href={`/pedidos/${pedido.id}`}
                        avatar={titulo.charAt(0).toUpperCase()}
                        titulo={titulo}
                        subtitulo={`Pedido ${pedido.numero ?? "—"} · ${formatarData(pedido.dataHoraUltimaAlteracao)}`}
                        valor={formatarMoeda(pedido.valorTotal)}
                        tag={<Badge enfase={situacao.enfase}>{situacao.rotulo}</Badge>}
                      />
                    );
                  })}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-ink">Notas fiscais recentes</h2>
              {resumo.notasFiscaisRecentes.length === 0 ? (
                <EstadoVazio mensagem="Nenhuma nota fiscal sincronizada ainda." />
              ) : (
                <div className="flex flex-col gap-3">
                  {resumo.notasFiscaisRecentes.map((nota) => {
                    const status = configStatusNfe(nota.statusNfe);
                    const titulo = `Nota ${nota.numero ?? "—"}${nota.serie ? `/${nota.serie}` : ""}`;
                    return (
                      <ListItem
                        key={nota.id}
                        avatar={rotuloTipoNotaFiscal(nota.tipo).charAt(0)}
                        titulo={titulo}
                        subtitulo={`${clienteDaNotaFiscal(nota)} · ${formatarData(nota.dataEmissao)}`}
                        valor={formatarMoeda(nota.valorTotalNotaFiscal)}
                        tag={<Badge enfase={status.enfase}>{status.rotulo}</Badge>}
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
