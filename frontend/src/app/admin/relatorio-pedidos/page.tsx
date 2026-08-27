import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { VendedorEquipeDto } from "@/lib/vendedores";
import {
  rotuloStatusAprovacao,
  OPCOES_STATUS_APROVACAO,
  type RelatorioPedidosDto,
} from "@/lib/relatorio-pedidos";
import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/formatacao";
import { Card } from "@/components/design/card";
import { PrimaryButton } from "@/components/design/button";
import { Badge } from "@/components/badge";
import { StatCard } from "@/components/design/stat-card";
import { IconeClipboard, IconeMoeda } from "@/components/design/icons";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";

// Painel administrativo de relatório diário de pedidos (OS-WEB-27) - NÃO
// existe uma versão mobile (OS-BACKEND-31) pra estender, decisão
// confirmada com o usuário: construído direto sobre GET /pedidos/relatorio
// (novo), que já resolve tudo isso - "pendente" (pipeline de aprovação de
// desconto, não status do ERP), dias pendente e o destaque de >1 dia
// (destaquePendenciaAntiga). Front só formata, nunca recalcula. Mesmo
// critério de acesso de /aprovacoes, /rastreio-equipe e /admin/visitas:
// sessão SSO normal, 403 vira "sem permissão" (não notFound()) - "gerente"
// aqui é a mesma resolução de escopo já usada nas outras 3 telas (própria
// subárvore, não literalmente "todo mundo" - ver comentário do backend).
// Só leitura - nenhuma ação de aprovar/rejeitar aqui (isso é /aprovacoes,
// OS-WEB-21); cada pedido linka pro histórico normal (/pedidos/:id).
export default async function RelatorioPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{
    vendedorId?: string;
    status?: string;
    dataInicial?: string;
    dataFinal?: string;
  }>;
}) {
  await exigirUsuarioAutenticado("/admin/relatorio-pedidos");

  const { vendedorId, status, dataInicial, dataFinal } = await searchParams;

  let relatorio: RelatorioPedidosDto | null = null;
  let equipe: VendedorEquipeDto[] = [];
  let semPermissao = false;
  let erro: string | null = null;

  try {
    const query = new URLSearchParams({
      ...(vendedorId && { vendedorId }),
      ...(status && { status }),
      ...(dataInicial && { dataInicial }),
      ...(dataFinal && { dataFinal }),
    });
    [relatorio, equipe] = await Promise.all([
      apiFetch<RelatorioPedidosDto>(`/pedidos/relatorio?${query}`, { cache: "no-store" }),
      apiFetch<VendedorEquipeDto[]>("/vendedores/equipe", { cache: "no-store" }),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      semPermissao = true;
    } else {
      erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
    }
  }

  const vendedoresComPedidos = relatorio?.vendedores.filter((v) => v.totalPedidos > 0) ?? [];
  const totalPedidos = relatorio?.vendedores.reduce((soma, v) => soma + v.totalPedidos, 0) ?? 0;
  const totalPendentesAtuais =
    relatorio?.vendedores.reduce((soma, v) => soma + v.pendentesAtuais, 0) ?? 0;

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Relatório diário de pedidos</h1>

      {semPermissao ? (
        <Card>
          <p className="text-sm text-muted">
            Você não tem papel de supervisão (supervisor ou gerente) - nenhum relatório de equipe
            para mostrar aqui.
          </p>
        </Card>
      ) : erro ? (
        <ErroConexao mensagem={erro} />
      ) : (
        relatorio && (
          <>
            {relatorio.periodo.dataInicial && (
              <p className="text-sm text-muted">
                Período: {formatarData(relatorio.periodo.dataInicial)} até{" "}
                {formatarData(relatorio.periodo.dataFinal)}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                icon={<IconeClipboard />}
                label="Pedidos no período"
                value={totalPedidos}
              />
              <StatCard
                icon={<IconeMoeda />}
                label="Aguardando aprovação (agora)"
                value={totalPendentesAtuais}
              />
            </div>

            <Card>
              <form
                method="get"
                action="/admin/relatorio-pedidos"
                className="flex flex-wrap items-end gap-3"
              >
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Vendedor
                  <select
                    name="vendedorId"
                    defaultValue={vendedorId ?? ""}
                    className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                  >
                    <option value="">Toda a equipe</option>
                    {equipe.map((vendedor) => (
                      <option key={vendedor.id} value={vendedor.id}>
                        {vendedor.nome ?? vendedor.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Status
                  <select
                    name="status"
                    defaultValue={status ?? ""}
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
                  De
                  <input
                    type="date"
                    name="dataInicial"
                    defaultValue={dataInicial}
                    className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-muted">
                  Até
                  <input
                    type="date"
                    name="dataFinal"
                    defaultValue={dataFinal}
                    className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                  />
                </label>
                <PrimaryButton type="submit">Filtrar</PrimaryButton>
              </form>
            </Card>

            {vendedoresComPedidos.length === 0 ? (
              <EstadoVazio mensagem="Nenhum pedido encontrado com esse filtro." />
            ) : (
              <div className="flex flex-col gap-6">
                {vendedoresComPedidos.map((vendedor) => (
                  <section key={vendedor.vendedorId} className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-semibold text-ink">
                        {vendedor.vendedorNome ?? "Vendedor não identificado"} (
                        {vendedor.totalPedidos})
                      </h2>
                      {vendedor.pendentesAtuais > 0 && (
                        <Badge enfase>
                          {vendedor.pendentesAtuais} aguardando aprovação agora
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col gap-3">
                      {vendedor.pedidos.map((pedido) => (
                        <Card
                          key={pedido.id}
                          className={
                            pedido.destaquePendenciaAntiga ? "border-2 border-ink" : undefined
                          }
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <Link
                                href={`/pedidos/${pedido.id}`}
                                className="text-sm font-medium text-ink hover:underline"
                              >
                                Pedido {pedido.numero ?? pedido.id} · Cliente{" "}
                                {pedido.cliente?.razaoSocial ?? "não identificado"}
                              </Link>
                              <p className="text-xs text-muted">
                                Última alteração:{" "}
                                {formatarDataHora(pedido.dataHoraUltimaAlteracao)} ·{" "}
                                {formatarMoeda(pedido.valorTotal)}
                              </p>
                              {pedido.diasPendente !== null && (
                                <p className="mt-1 text-xs text-muted">
                                  Aguardando aprovação há {pedido.diasPendente} dia(s)
                                  {pedido.destaquePendenciaAntiga && " - gargalo de aprovação"}
                                </p>
                              )}
                            </div>
                            <Badge enfase={pedido.statusAprovacao === "APROVADO"}>
                              {rotuloStatusAprovacao(pedido.statusAprovacao)}
                            </Badge>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )
      )}
    </main>
  );
}
