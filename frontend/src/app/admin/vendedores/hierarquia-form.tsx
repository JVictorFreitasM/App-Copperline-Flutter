"use client";

import { useActionState } from "react";
import { PrimaryButton } from "@/components/design/button";
import { OPCOES_PAPEL, rotuloPapel, type VendedorListaDto } from "@/lib/vendedores";
import { atualizarHierarquia } from "./actions";
import type { EstadoHierarquia } from "./actions";

const ESTADO_INICIAL: EstadoHierarquia = { erro: null, sucesso: null };

// Client component isolado (OS-WEB-28) - useActionState pra mostrar
// sucesso/erro e desabilitar "Salvar" durante o pending sem navegar (a
// lista continua Server Component, atualizada via revalidatePath dentro
// da action) - antes disso, salvar fazia redirect() so pra levar
// `?sucesso=`/`?erro=` na URL, resetando o scroll da pagina inteira a cada
// edição de hierarquia.
export function HierarquiaForm({
  vendedor,
  opcoesSupervisor,
}: {
  vendedor: VendedorListaDto;
  opcoesSupervisor: VendedorListaDto[];
}) {
  const [estado, acao, pending] = useActionState(
    atualizarHierarquia.bind(null, vendedor.id),
    ESTADO_INICIAL,
  );

  return (
    <form
      action={acao}
      className="mt-3 flex flex-wrap items-end gap-3 rounded-card bg-background p-4"
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Papel
        <select
          name="papel"
          defaultValue={vendedor.papel}
          className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
        >
          {OPCOES_PAPEL.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Supervisor
        <select
          name="supervisorId"
          defaultValue={vendedor.supervisorId ?? ""}
          className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
        >
          <option value="">Nenhum</option>
          {opcoesSupervisor.map((opcao) => (
            <option key={opcao.id} value={opcao.id}>
              {opcao.nome ?? opcao.id} ({rotuloPapel(opcao.papel)})
            </option>
          ))}
        </select>
      </label>
      <PrimaryButton type="submit" disabled={pending}>
        Salvar
      </PrimaryButton>
      {estado.sucesso && <p className="text-xs font-medium text-ink">{estado.sucesso}</p>}
      {estado.erro && <p className="text-xs font-medium text-muted">{estado.erro}</p>}
    </form>
  );
}
