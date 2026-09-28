import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { formatarDataHora } from "@/lib/formatacao";
import { configSituacaoPedido } from "@/lib/pedidos";
import { EstadoVazio, ErroConexao } from "@/components/listagem-feedback";
import { AbasPedido } from "../abas-pedido";

interface PedidoHistoricoStatusDto {
  id: string;
  statusAnterior: string | null;
  statusNovo: string;
  alteradoPor: { id: string; nome: string } | null;
  alteradoEm: string;
}

// Aba "HISTÓRICO" da tela de detalhe do pedido (layout de referencia
// ref1.jpeg) - consome GET /pedidos/:id/historico (OS-BACKEND-33), ja
// existente no backend sem UI ate agora.
export default async function PedidoHistoricoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirUsuarioAutenticado("/pedidos");
  const { id } = await params;

  let historico: PedidoHistoricoStatusDto[] | null = null;
  let erro: string | null = null;

  try {
    historico = await apiFetch<PedidoHistoricoStatusDto[]>(
      `/pedidos/${encodeURIComponent(id)}/historico`,
      { cache: "no-store" },
    );
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <Link href="/pedidos" className="text-sm font-medium text-muted hover:text-ink">
        « Lista de pedidos
      </Link>

      <AbasPedido pedidoId={id} numeroExibido={id.slice(0, 8)} abaAtiva="historico" />

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : historico && historico.length === 0 ? (
        <EstadoVazio mensagem="Nenhuma alteração de status registrada para este pedido." />
      ) : (
        historico && (
          <div className="rounded-card bg-surface p-6 shadow-sm">
            <ol className="flex flex-col gap-4">
              {historico.map((registro) => (
                <li key={registro.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {registro.statusAnterior
                        ? `${configSituacaoPedido(registro.statusAnterior).rotulo} → ${configSituacaoPedido(registro.statusNovo).rotulo}`
                        : configSituacaoPedido(registro.statusNovo).rotulo}
                    </p>
                    <p className="text-xs text-muted">
                      {registro.alteradoPor?.nome ?? "Sistema"}
                    </p>
                  </div>
                  <span className="text-xs text-muted">{formatarDataHora(registro.alteradoEm)}</span>
                </li>
              ))}
            </ol>
          </div>
        )
      )}
    </main>
  );
}
