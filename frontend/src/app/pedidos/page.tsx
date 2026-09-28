import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import {
  configStatusExibicaoPedido,
  OPCOES_SITUACAO_PEDIDO,
  OPCOES_STATUS_APROVACAO,
  UFS_BRASIL,
  type PedidoResumoDto,
} from "@/lib/pedidos";
import type { VendedorEquipeDto } from "@/lib/vendedores";
import { formatarData, formatarMoeda } from "@/lib/formatacao";
import type { PaginatedResult } from "@/lib/pagination";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { Paginacao } from "@/components/paginacao";
import { Badge } from "@/components/badge";
import { FiltroForm, CampoFiltro } from "@/components/filtro";
import { PrimaryButton, SecondaryButton } from "@/components/design/button";
import { IconeAlerta } from "@/components/design/icons";

const LIMITE_POR_PAGINA = 20;

// Layout de referencia (imagem fornecida pelo usuario, ref.jpeg) - troca a
// lista de ListItem (padrao do resto do app) por uma tabela densa de
// verdade, deliberadamente: o usuario pediu explicitamente "tabela",
// espelhando uma tela de ERP com muita coluna simultanea, o que o cartao
// ListItem nao comporta bem. Sem os botoes "Expedir"/"Imprimir"/"Exportar"
// (excluidos/adiados por pedido explicito do usuario) - ver
// OS-pendentes-claude-code.md pra as pendencias documentadas (Categoria,
// Tipo de Pedido, Status de cobranca por pedido).
export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    clienteNome?: string;
    situacao?: string;
    dataInicial?: string;
    dataFinal?: string;
    vendedorId?: string;
    statusAprovacao?: string;
    ufEntrega?: string;
  }>;
}) {
  await exigirUsuarioAutenticado("/pedidos");

  const params = await searchParams;
  const paginaParam = Number(params.page);
  const pagina = Number.isInteger(paginaParam) && paginaParam > 0 ? paginaParam : 1;
  const clienteNome = params.clienteNome?.trim() || undefined;
  const situacao = params.situacao?.trim() || undefined;
  const dataInicial = params.dataInicial?.trim() || undefined;
  const dataFinal = params.dataFinal?.trim() || undefined;
  const vendedorId = params.vendedorId?.trim() || undefined;
  const statusAprovacao = params.statusAprovacao?.trim() || undefined;
  const ufEntrega = params.ufEntrega?.trim() || undefined;

  let resultado: PaginatedResult<PedidoResumoDto> | null = null;
  let erro: string | null = null;

  try {
    const query = new URLSearchParams({
      page: String(pagina),
      limit: String(LIMITE_POR_PAGINA),
      ...(clienteNome && { clienteNome }),
      ...(situacao && { situacao }),
      ...(dataInicial && { dataInicial }),
      ...(dataFinal && { dataFinal }),
      ...(vendedorId && { vendedorId }),
      ...(statusAprovacao && { statusAprovacao }),
      ...(ufEntrega && { ufEntrega }),
    });
    resultado = await apiFetch<PaginatedResult<PedidoResumoDto>>(`/pedidos?${query}`, {
      cache: "no-store",
    });
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  // Equipe (filtro) e contadores dos atalhos rapidos - isolados (mesmo
  // criterio de resiliencia ja usado em outras telas): uma falha aqui nao
  // derruba a listagem principal, que ja teve sucesso acima.
  let equipe: VendedorEquipeDto[] = [];
  let contadores = { naoIntegrados: 0, aguardandoAprovacao: 0, orcamentos: 0 };
  try {
    [equipe, contadores] = await Promise.all([
      apiFetch<VendedorEquipeDto[]>("/vendedores/equipe", { cache: "no-store" }),
      apiFetch<{ naoIntegrados: number; aguardandoAprovacao: number; orcamentos: number }>(
        "/pedidos/contadores",
        { cache: "no-store" },
      ),
    ]);
  } catch {
    // Silencioso - filtro de equipe some/contadores ficam em 0, resto da
    // tela funciona normalmente.
  }

  const filtrosAtuais = {
    clienteNome,
    situacao,
    dataInicial,
    dataFinal,
    vendedorId,
    statusAprovacao,
    ufEntrega,
  };

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Pedidos</h1>
        <div className="flex flex-wrap gap-3">
          <PrimaryButton href="/pedidos/novo">Criar pedido</PrimaryButton>
          <SecondaryButton href="/pedidos/novo?orcamento=1">Criar orçamento</SecondaryButton>
        </div>
      </div>

      {/* Atalhos rapidos (layout de referencia) - mesmo bucket usado no
          filtro "Status de aprovacao" abaixo, so' outra forma de chegar
          nele. "Nao integrados" = pedido local, idExternoErp ainda null
          (nunca confirmado no Radar) - ver backend, listar-pedidos-query.dto.ts. */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/pedidos"
          scroll={false}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            !statusAprovacao ? "bg-solid text-on-solid" : "bg-surface text-ink shadow-sm hover:opacity-80"
          }`}
        >
          Todos
        </Link>
        <Link
          href="/pedidos?statusAprovacao=NAO_INTEGRADO"
          scroll={false}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            statusAprovacao === "NAO_INTEGRADO"
              ? "bg-solid text-on-solid"
              : "bg-surface text-ink shadow-sm hover:opacity-80"
          }`}
        >
          Não integrados ({contadores.naoIntegrados})
        </Link>
        <Link
          href="/pedidos?statusAprovacao=AGUARDANDO_APROVACAO"
          scroll={false}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            statusAprovacao === "AGUARDANDO_APROVACAO"
              ? "bg-solid text-on-solid"
              : "bg-surface text-ink shadow-sm hover:opacity-80"
          }`}
        >
          Aguardando aprovação ({contadores.aguardandoAprovacao})
        </Link>
        <Link
          href="/pedidos?statusAprovacao=ORCAMENTO"
          scroll={false}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            statusAprovacao === "ORCAMENTO"
              ? "bg-solid text-on-solid"
              : "bg-surface text-ink shadow-sm hover:opacity-80"
          }`}
        >
          Orçamentos ({contadores.orcamentos})
        </Link>
      </div>

      <FiltroForm rota="/pedidos">
        <CampoFiltro label="Cliente" name="clienteNome" defaultValue={clienteNome} />
        <label className="flex flex-col gap-1 text-sm text-muted">
          Equipe
          <select
            name="vendedorId"
            defaultValue={vendedorId ?? ""}
            className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          >
            <option value="">Todos</option>
            {equipe.map((vendedor) => (
              <option key={vendedor.id} value={vendedor.id}>
                {vendedor.nome ?? "—"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Status de aprovação
          <select
            name="statusAprovacao"
            defaultValue={statusAprovacao ?? ""}
            className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          >
            <option value="">Todos</option>
            {OPCOES_STATUS_APROVACAO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Status de entrega
          <select
            name="situacao"
            defaultValue={situacao ?? ""}
            className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          >
            <option value="">Todos</option>
            {OPCOES_SITUACAO_PEDIDO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Localização
          <select
            name="ufEntrega"
            defaultValue={ufEntrega ?? ""}
            className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          >
            <option value="">Qualquer</option>
            {UFS_BRASIL.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </label>
        <CampoFiltro label="De" name="dataInicial" defaultValue={dataInicial} type="date" />
        <CampoFiltro label="Até" name="dataFinal" defaultValue={dataFinal} type="date" />
      </FiltroForm>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : resultado && resultado.data.length === 0 ? (
        <EstadoVazio mensagem="Nenhum pedido encontrado." />
      ) : (
        resultado && (
          <>
            <div className="overflow-x-auto rounded-card bg-surface shadow-sm">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs font-medium text-muted">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Tipo de Pedido</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Data de Criação / Vendedor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.data.map((pedido) => {
                    const situacaoConfig = configStatusExibicaoPedido(pedido);
                    return (
                      <tr key={pedido.id} className="border-b border-line last:border-0 hover:bg-background">
                        <td className="px-4 py-3">
                          <Link
                            href={`/pedidos/${pedido.id}`}
                            className="flex items-center gap-2 font-medium text-primary hover:underline"
                          >
                            {pedido.temSolicitacaoDescontoPendente && (
                              <span className="text-ink" title="Aguardando aprovação de desconto">
                                <IconeAlerta />
                              </span>
                            )}
                            {pedido.numero ?? pedido.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted">Venda</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink">
                            {pedido.cliente?.razaoSocial ?? "Cliente não identificado"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {/* dataEmissao/dataHoraUltimaAlteracao so vem do Radar - fica
                              null pro pedido recem-criado ate sincronizar de volta.
                              sincronizadoEm nunca e null (achado 2026-09-28: sem esse
                              fallback a coluna ficava vazia num pedido acabado de criar). */}
                          <p>
                            {formatarData(
                              pedido.dataEmissao ?? pedido.dataHoraUltimaAlteracao ?? pedido.sincronizadoEm,
                            )}
                          </p>
                          <p className="text-xs">{pedido.vendedor?.nome ?? "—"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge enfase={situacaoConfig.enfase}>{situacaoConfig.rotulo}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-ink">
                          {formatarMoeda(pedido.valorTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Paginacao rota="/pedidos" pagina={resultado.meta.page} totalPaginas={resultado.meta.totalPages} filtros={filtrosAtuais} />
          </>
        )
      )}
    </main>
  );
}
