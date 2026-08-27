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

  // OS-WEB-29: cada secao busca seu proprio dado de forma independente
  // (Promise.allSettled, nao Promise.all) - uma falha isolada num unico
  // endpoint (timeout, erro transitorio) nao derruba o painel inteiro com
  // um erro generico; so a secao afetada mostra sua propria mensagem,
  // as demais continuam renderizando normalmente. Investigacao (executar
  // DashboardService diretamente contra dado real de producao, cobrindo
  // periodo vazio, periodo invertido, ausencia de filtro): nenhum dos 4
  // endpoints de periodo lancou excecao em nenhum cenario testado - a
  // divisao por zero do ticket medio (obterVendas) ja era tratada. Mesmo
  // sem reproduzir uma excecao real do backend, a falha "tudo ou nada" do
  // Promise.all original e' em si um problema defensivo (um timeout
  // isolado em QUALQUER um dos 5 endpoints derrubava o painel inteiro) -
  // corrigido independente da causa original nao ter sido reproduzida.
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

      {resumo ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard icon={<IconePessoas />} label="Clientes ativos" value={resumo.clientesAtivos} />
          <StatCard icon={<IconeCaixa />} label="Produtos ativos" value={resumo.produtosAtivos} />
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
      ) : (
        <ErroConexao mensagem={erroResumo!} />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
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
              formatarValor={(valor) => formatarMoeda(String(valor))}
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
              formatarValor={(valor) => formatarMoeda(String(valor))}
            />
          )}
        </Card>
      </div>

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

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Pedidos recentes</h2>
        {!resumo ? (
          <ErroConexao mensagem={erroResumo!} />
        ) : resumo.pedidosRecentes.length === 0 ? (
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
        {!resumo ? (
          <ErroConexao mensagem={erroResumo!} />
        ) : resumo.notasFiscaisRecentes.length === 0 ? (
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
    </main>
  );
}
