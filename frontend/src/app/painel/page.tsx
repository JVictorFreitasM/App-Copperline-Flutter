import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { ResumoDashboardDto } from "@/lib/dashboard";
import { formatarData, formatarMoeda } from "@/lib/formatacao";
import { configSituacaoPedido } from "@/lib/pedidos";
import { clienteDaNotaFiscal, configStatusNfe, rotuloTipoNotaFiscal } from "@/lib/notas-fiscais";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { StatCard } from "@/components/design/stat-card";
import { ListItem } from "@/components/design/list-item";
import { Badge } from "@/components/badge";
import { PrimaryButton, SecondaryButton } from "@/components/design/button";
import { IconeCaixa, IconeClipboard, IconeMoeda, IconePessoas } from "@/components/design/icons";

// Tela de resumo (dashboard) - substitui a antiga /painel (que so mostrava
// dados do usuario logado, sem funcao real - ver historico da OS 10).
// Consome GET /dashboard/resumo, ja nascendo com os componentes do design
// system. "Estoque baixo" (mencionado como exemplo na skill design-system)
// fica de fora - depende da sincronizacao agendada de estoque, que esta
// pausada (ver OS-BACKEND-14).
export default async function PainelPage() {
  const user = await exigirUsuarioAutenticado("/painel");

  let resumo: ResumoDashboardDto | null = null;
  let erro: string | null = null;

  try {
    resumo = await apiFetch<ResumoDashboardDto>("/dashboard/resumo", {
      cache: "no-store",
    });
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

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : (
        resumo && (
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
