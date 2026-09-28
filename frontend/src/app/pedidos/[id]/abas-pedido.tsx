import Link from "next/link";
import { BotaoExportarPdfPedido } from "./botao-exportar-pdf-pedido";

// Extraido de page.tsx/historico/page.tsx (2026-09-28) - as duas telas
// duplicavam a mesma barra de abas; extrair virou necessario ao adicionar
// o botao "Exportar PDF" (pedido do usuario: "do lado direito da aba
// HISTÓRICO"), que agora so precisa existir num lugar em vez de nos dois.
export function AbasPedido({
  pedidoId,
  numeroExibido,
  abaAtiva,
}: {
  pedidoId: string;
  numeroExibido: string;
  abaAtiva: "pedido" | "historico";
}) {
  return (
    <div className="flex items-end gap-6 border-b border-line">
      {abaAtiva === "pedido" ? (
        <span className="border-b-2 border-primary pb-3 text-sm font-semibold text-ink">
          PEDIDO Nº: {numeroExibido}
        </span>
      ) : (
        <Link
          href={`/pedidos/${pedidoId}`}
          className="pb-3 text-sm font-medium text-muted hover:text-ink"
        >
          PEDIDO Nº: {numeroExibido}
        </Link>
      )}

      {abaAtiva === "historico" ? (
        <span className="border-b-2 border-primary pb-3 text-sm font-semibold text-ink">
          HISTÓRICO
        </span>
      ) : (
        <Link
          href={`/pedidos/${pedidoId}/historico`}
          className="pb-3 text-sm font-medium text-muted hover:text-ink"
        >
          HISTÓRICO
        </Link>
      )}

      <BotaoExportarPdfPedido pedidoId={pedidoId} />
    </div>
  );
}
