"use client";

import { useActionState } from "react";
import { SecondaryButton } from "@/components/design/button";
import { definirTabelaPadrao, ESTADO_DEFINIR_PADRAO_INICIAL } from "./actions";

// Admin-only (checagem real no backend, requireRole('admin')) - a página
// já só renderiza isso quando usuario.role === "admin" (ver page.tsx).
export function DefinirPadraoForm({ tabelaId, padrao }: { tabelaId: string; padrao: boolean }) {
  const acaoComId = definirTabelaPadrao.bind(null, tabelaId);
  const [estado, acao, pending] = useActionState(acaoComId, ESTADO_DEFINIR_PADRAO_INICIAL);

  if (padrao) {
    return <p className="text-xs font-medium text-muted">Esta já é a tabela padrão.</p>;
  }

  return (
    <form action={acao} className="flex flex-col items-start gap-2">
      <SecondaryButton type="submit" disabled={pending}>
        {pending ? "Definindo..." : "Definir como tabela padrão"}
      </SecondaryButton>
      {estado.erro && <p className="text-xs font-medium text-muted">{estado.erro}</p>}
    </form>
  );
}
