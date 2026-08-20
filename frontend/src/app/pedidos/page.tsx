import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import {
  configSituacaoPedido,
  OPCOES_SITUACAO_PEDIDO,
  type PedidoResumoDto,
} from "@/lib/pedidos";
import { formatarData, formatarMoeda } from "@/lib/formatacao";
import type { PaginatedResult } from "@/lib/pagination";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { Paginacao } from "@/components/paginacao";
import { Badge } from "@/components/badge";
import { FiltroForm, CampoFiltro } from "@/components/filtro";
import { ListItem } from "@/components/design/list-item";

const LIMITE_POR_PAGINA = 20;

// Terceira tela de negocio (OS-WEB-13) - consome GET /pedidos
// (OS-BACKEND-11). Filtro (cliente por nome, situação, período de data) e
// link pro detalhe adicionados na OS-WEB-15 - clienteNome e período
// (dataInicial/dataFinal) exigiram estender ListarPedidosQueryDto no
// backend, que só aceitava clienteId (uuid) e situação antes. Retrofit
// visual (OS-WEB-16): tabela virou lista de ListItem, badge agora usa só
// ink/cinza (ver lib/pedidos.ts, configSituacaoPedido).
export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    clienteNome?: string;
    situacao?: string;
    dataInicial?: string;
    dataFinal?: string;
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
    });
    resultado = await apiFetch<PaginatedResult<PedidoResumoDto>>(`/pedidos?${query}`, {
      cache: "no-store",
    });
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Pedidos</h1>

      <FiltroForm rota="/pedidos">
        <CampoFiltro label="Cliente" name="clienteNome" defaultValue={clienteNome} />
        <label className="flex flex-col gap-1 text-sm text-muted">
          Situação
          <select
            name="situacao"
            defaultValue={situacao ?? ""}
            className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          >
            <option value="">Todas</option>
            {OPCOES_SITUACAO_PEDIDO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
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
            <div className="flex flex-col gap-3">
              {resultado.data.map((pedido) => {
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

            <Paginacao
              rota="/pedidos"
              pagina={resultado.meta.page}
              totalPaginas={resultado.meta.totalPages}
              filtros={{ clienteNome, situacao, dataInicial, dataFinal }}
            />
          </>
        )
      )}
    </main>
  );
}
