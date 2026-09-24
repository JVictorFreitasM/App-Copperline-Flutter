"use client";

import { useActionState } from "react";
import { PrimaryButton } from "@/components/design/button";
import type { VendedorListaDto } from "@/lib/vendedores";
import { criarCobertura } from "./actions";
import type { EstadoCriarCobertura } from "./actions";

const ESTADO_INICIAL: EstadoCriarCobertura = { erro: null, sucesso: null };

// Mesmo padrao de CriarTipoForm (admin/tipos-acondicionamento) -
// useActionState pra sucesso/erro sem navegar, lista atualizada via
// revalidatePath dentro da action.
export function CriarCoberturaForm({ vendedores }: { vendedores: VendedorListaDto[] }) {
  const [estado, acao, pending] = useActionState(criarCobertura, ESTADO_INICIAL);

  return (
    <form action={acao} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Vendedor original (carteira coberta)
        <select
          name="vendedorOriginalId"
          defaultValue=""
          className="w-56 rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
        >
          <option value="" disabled>
            Selecione
          </option>
          {vendedores.map((vendedor) => (
            <option key={vendedor.id} value={vendedor.id}>
              {vendedor.nome ?? vendedor.id}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Vendedor substituto
        <select
          name="vendedorSubstitutoId"
          defaultValue=""
          className="w-56 rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
        >
          <option value="" disabled>
            Selecione
          </option>
          {vendedores.map((vendedor) => (
            <option key={vendedor.id} value={vendedor.id}>
              {vendedor.nome ?? vendedor.id}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        De
        <input
          type="date"
          name="dataInicio"
          className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Até
        <input
          type="date"
          name="dataFim"
          className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
        />
      </label>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Criando..." : "Criar cobertura"}
      </PrimaryButton>
      {estado.sucesso && <p className="text-xs font-medium text-ink">{estado.sucesso}</p>}
      {estado.erro && <p className="text-xs font-medium text-muted">{estado.erro}</p>}
    </form>
  );
}
