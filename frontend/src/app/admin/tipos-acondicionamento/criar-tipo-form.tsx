"use client";

import { useActionState } from "react";
import { PrimaryButton } from "@/components/design/button";
import { criarTipoAcondicionamento } from "./actions";
import { ESTADO_CRIAR_TIPO_INICIAL } from "./estado-criar-tipo";

export function CriarTipoForm() {
  const [estado, acao, pending] = useActionState(
    criarTipoAcondicionamento,
    ESTADO_CRIAR_TIPO_INICIAL,
  );

  return (
    <form action={acao} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Novo tipo de acondicionamento
        <input
          type="text"
          name="nome"
          placeholder="Ex: Rolo, Caixa, Palete"
          className="w-64 rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Tamanho padrão (m) - vazio = retalho
        <input
          type="number"
          name="tamanhoPadrao"
          step="0.001"
          min="0"
          placeholder="Ex: 100"
          className="w-40 rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
        />
      </label>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Cadastrando..." : "Cadastrar"}
      </PrimaryButton>
      {estado.sucesso && <p className="text-xs font-medium text-ink">{estado.sucesso}</p>}
      {estado.erro && <p className="text-xs font-medium text-muted">{estado.erro}</p>}
    </form>
  );
}
