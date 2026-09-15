"use client";

import { useActionState } from "react";
import { PrimaryButton } from "@/components/design/button";
import type { TipoAcondicionamentoDto } from "@/lib/tipos-acondicionamento";
import { atualizarTipoAcondicionamento } from "./actions";
import { ESTADO_EDICAO_MANUAL_INICIAL } from "./estado-edicao-manual";

// Mesmo padrão de EditarPrecoFabricacaoForm - admin-only (checagem real no
// backend, requireRole('admin')). OS-novas-implementacoes.md Bloco 4.
export function EditarTipoAcondicionamentoForm({
  produtoId,
  tipoAtualId,
  opcoes,
}: {
  produtoId: string;
  tipoAtualId: string | null;
  opcoes: TipoAcondicionamentoDto[];
}) {
  const acaoComId = atualizarTipoAcondicionamento.bind(null, produtoId);
  const [estado, acao, pending] = useActionState(acaoComId, ESTADO_EDICAO_MANUAL_INICIAL);

  return (
    <form action={acao} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Tipo de acondicionamento
        <select
          name="tipoAcondicionamentoId"
          defaultValue={tipoAtualId ?? ""}
          className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
        >
          <option value="">Nenhum</option>
          {opcoes.map((opcao) => (
            <option key={opcao.id} value={opcao.id}>
              {opcao.nome}
            </option>
          ))}
        </select>
      </label>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </PrimaryButton>
      {estado.sucesso && <p className="text-xs font-medium text-ink">{estado.sucesso}</p>}
      {estado.erro && <p className="text-xs font-medium text-muted">{estado.erro}</p>}
    </form>
  );
}
