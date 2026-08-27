"use client";

import { useActionState } from "react";
import { PrimaryButton } from "@/components/design/button";
import { DIAS_SEMANA, rotuloEntidade, type ConfiguracaoSyncDto } from "@/lib/admin-sync";
import { atualizarCadencia } from "./actions";
import type { EstadoSync } from "./actions";

const ESTADO_INICIAL: EstadoSync = { erro: null, sucesso: null };

// Client component isolado (OS-WEB-28) - ver comentario em actions.ts.
export function CadenciaForm({
  config,
  restrito,
}: {
  config: ConfiguracaoSyncDto;
  restrito: boolean;
}) {
  const [estado, acao, pending] = useActionState(
    atualizarCadencia.bind(null, config.nomeEntidade),
    ESTADO_INICIAL,
  );

  return (
    <form action={acao} className="mt-3 flex flex-col gap-3 rounded-card bg-background p-4">
      {restrito && (
        <p className="text-xs text-muted">
          &apos;{rotuloEntidade(config.nomeEntidade)}&apos; não suporta cadência Incremental — o ERP não permite
          filtrar só o que mudou pra essa entidade (limitação estrutural, não configurável). Use
          Configurável (intervalo fixo) ou um horário fixo.
        </p>
      )}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Tipo de cadência
        <select
          name="tipoCadencia"
          defaultValue={config.tipoCadencia}
          className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
        >
          <option value="INCREMENTAL" disabled={restrito}>
            Incremental
          </option>
          <option value="CONFIGURAVEL">Configurável (intervalo fixo)</option>
          <option value="INCREMENTAL_NOTURNO">Incremental noturno (horário fixo)</option>
          <option value="JANELA_FIXA_DIARIA">Janela fixa diária (horário fixo)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Intervalo em minutos (obrigatório para Incremental/Configurável)
        <input
          type="number"
          name="intervaloMinutos"
          min={1}
          defaultValue={config.intervaloMinutos ?? undefined}
          className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Horário fixo HH:mm (obrigatório para Incremental noturno/Janela fixa diária)
        <input
          type="text"
          name="horarioFixo"
          placeholder="HH:mm"
          defaultValue={config.horarioFixo ?? undefined}
          className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
        />
      </label>
      <fieldset className="flex flex-col gap-1 text-xs font-medium text-muted">
        <legend>Dias da semana (nenhum marcado = todos os dias)</legend>
        <div className="flex flex-wrap gap-3">
          {DIAS_SEMANA.map((dia, indice) => (
            <label key={dia} className="flex items-center gap-1 font-normal text-ink">
              <input
                type="checkbox"
                name="diasSemana"
                value={indice}
                defaultChecked={config.diasSemana.includes(indice)}
              />
              {dia}
            </label>
          ))}
        </div>
      </fieldset>
      <PrimaryButton type="submit" className="self-start" disabled={pending}>
        Salvar cadência
      </PrimaryButton>
      {estado.sucesso && <p className="text-xs font-medium text-ink">{estado.sucesso}</p>}
      {estado.erro && <p className="text-xs font-medium text-muted">{estado.erro}</p>}
    </form>
  );
}
