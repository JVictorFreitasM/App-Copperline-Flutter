"use client";

import { useActionState } from "react";
import { PrimaryButton } from "@/components/design/button";
import { selecionarTabelaPreco, ESTADO_SELECAO_TABELA_INICIAL } from "./actions";

// Admin-only (checagem real no backend). Texto livre (não um <select>
// entre tabelas já sincronizadas) de propósito - a seleção acontece ANTES
// de qualquer sync, então nem sempre há tabelas locais pra escolher entre
// (ex: primeira configuração do sistema).
export function SelecionarTabelaForm({ codigoAtual }: { codigoAtual: string | null }) {
  const [estado, acao, pending] = useActionState(
    selecionarTabelaPreco,
    ESTADO_SELECAO_TABELA_INICIAL,
  );

  return (
    <form action={acao} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Código da tabela de preço (ex: 110)
        <input
          type="text"
          name="codigo"
          required
          defaultValue={codigoAtual ?? ""}
          placeholder="110"
          className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
        />
      </label>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Selecionar"}
      </PrimaryButton>
      {estado.sucesso && <p className="text-xs font-medium text-ink">{estado.sucesso}</p>}
      {estado.erro && <p className="text-xs font-medium text-muted">{estado.erro}</p>}
    </form>
  );
}
