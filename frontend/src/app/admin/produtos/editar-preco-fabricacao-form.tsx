"use client";

import { useActionState } from "react";
import { PrimaryButton } from "@/components/design/button";
import { atualizarPrecoFabricacao } from "./actions";
import { ESTADO_EDICAO_MANUAL_INICIAL } from "./estado-produtos-admin";

// Movido de produtos/[id] pro admin (pedido do usuário, 2026-09-29) -
// admin-only (checagem real fica no backend, requireRole('admin') - ver
// produtos.module.ts); a página só renderiza isto dentro da área de
// produto selecionado (a própria /admin/produtos já é admin-only).
export function EditarPrecoFabricacaoForm({
  produtoId,
  valorAtual,
}: {
  produtoId: string;
  valorAtual: string | null;
}) {
  const acaoComId = atualizarPrecoFabricacao.bind(null, produtoId);
  const [estado, acao, pending] = useActionState(acaoComId, ESTADO_EDICAO_MANUAL_INICIAL);

  return (
    <form action={acao} className="flex flex-wrap items-end gap-3">
      <label className="flex w-72 flex-col gap-1 text-xs font-medium text-muted">
        Preço de fabricação (R$)
        <input
          type="number"
          name="precoFabricacao"
          step="0.01"
          min="0"
          defaultValue={valorAtual ?? ""}
          placeholder="0,00"
          className="w-full rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
        />
      </label>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </PrimaryButton>
      {estado.sucesso && <p className="text-xs font-medium text-ink">{estado.sucesso}</p>}
      {estado.erro && <p className="text-xs font-medium text-muted">{estado.erro}</p>}
    </form>
  );
}
