"use client";

import { useActionState, useState } from "react";
import { PrimaryButton } from "@/components/design/button";
import { mesAnoAtual, OPCOES_TIPO_META, semanaIsoAtual, type TipoPeriodicidadeMeta } from "@/lib/metas";
import { definirMetaVendedor } from "./actions";
import type { EstadoDefinirMeta } from "./actions";

const ESTADO_INICIAL: EstadoDefinirMeta = { erro: null, sucesso: null };

// Mesmo padrao de HierarquiaForm (admin/vendedores/hierarquia-form.tsx) -
// useActionState com a action ja bindada ao vendedorId.
//
// Pedido do usuario (2026-09-28): so um tipo de meta ativo por vez
// (Dinheiro/Peso/Margem, radio - nunca checkbox multiplo) e mensal/semanal
// podem coexistir (cada uma e' um registro separado no backend, ver
// meta-vendedor.service.ts) - por isso o form tem um seletor de
// periodicidade que TROCA qual input de periodo aparece (mes ou semana),
// em vez dos dois juntos.
export function DefinirMetaForm({ vendedorId }: { vendedorId: string }) {
  const [estado, acao, pending] = useActionState(
    definirMetaVendedor.bind(null, vendedorId),
    ESTADO_INICIAL,
  );
  const [periodicidade, setPeriodicidade] = useState<TipoPeriodicidadeMeta>("MENSAL");

  return (
    <form action={acao} className="flex flex-col gap-3 rounded-card bg-background p-4">
      <div className="flex flex-wrap items-end gap-3">
        <fieldset className="flex flex-col gap-1 text-xs font-medium text-muted">
          Periodicidade
          <div className="flex overflow-hidden rounded-full bg-surface">
            {(["MENSAL", "SEMANAL"] as const).map((opcao) => (
              <label
                key={opcao}
                className={`cursor-pointer px-3 py-2 text-sm transition ${
                  periodicidade === opcao ? "bg-solid text-on-solid" : "text-ink"
                }`}
              >
                <input
                  type="radio"
                  name="periodicidade"
                  value={opcao}
                  checked={periodicidade === opcao}
                  onChange={() => setPeriodicidade(opcao)}
                  className="sr-only"
                />
                {opcao === "MENSAL" ? "Mensal" : "Semanal"}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          {periodicidade === "MENSAL" ? "Mês" : "Semana"}
          {periodicidade === "MENSAL" ? (
            <input
              type="month"
              name="periodo"
              defaultValue={mesAnoAtual()}
              className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
            />
          ) : (
            <input
              type="week"
              name="periodo"
              defaultValue={semanaIsoAtual()}
              className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
            />
          )}
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Meta
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
      </div>

      <fieldset className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted">
        Tipo de meta
        {OPCOES_TIPO_META.map((opcao) => (
          <label key={opcao.valor} className="flex items-center gap-1.5 text-sm text-ink">
            <input
              type="radio"
              name="tipoMeta"
              value={opcao.valor}
              defaultChecked={opcao.valor === "DINHEIRO"}
            />
            {opcao.rotulo}
          </label>
        ))}
      </fieldset>

      {estado.sucesso && <p className="text-xs font-medium text-ink">{estado.sucesso}</p>}
      {estado.erro && <p className="text-xs font-medium text-muted">{estado.erro}</p>}
    </form>
  );
}
