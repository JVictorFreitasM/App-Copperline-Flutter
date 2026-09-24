"use client";

import { useActionState } from "react";
import { PrimaryButton } from "@/components/design/button";
import { mesAnoAtual } from "@/lib/metas";
import { definirMetaVendedor } from "./actions";
import type { EstadoDefinirMeta } from "./actions";

const ESTADO_INICIAL: EstadoDefinirMeta = { erro: null, sucesso: null };

// Mesmo padrao de HierarquiaForm (admin/vendedores/hierarquia-form.tsx) -
// useActionState com a action ja bindada ao vendedorId.
export function DefinirMetaForm({ vendedorId }: { vendedorId: string }) {
  const [estado, acao, pending] = useActionState(
    definirMetaVendedor.bind(null, vendedorId),
    ESTADO_INICIAL,
  );

  return (
    <form action={acao} className="flex flex-wrap items-end gap-3 rounded-card bg-background p-4">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Mês
        <input
          type="month"
          name="mesAno"
          defaultValue={mesAnoAtual()}
          className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Meta (R$)
        <input
          type="number"
          name="valorMeta"
          step="0.01"
          min="0.01"
          placeholder="Ex: 50000"
          className="w-40 rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
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
