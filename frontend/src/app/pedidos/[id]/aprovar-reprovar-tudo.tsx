"use client";

import { useActionState } from "react";
import { aprovarTodosItens, rejeitarTodosItens } from "./actions";
import type { EstadoDecisaoItem } from "./actions";

const ESTADO_INICIAL: EstadoDecisaoItem = { erro: null };

// "Salvar"/"Reprovar tudo"/"Aprovar tudo" (layout de referencia ref1.jpeg) -
// cores vermelho/verde SAO uma excecao deliberada à paleta neutra do
// design system (ver skill design-system: "nao introduzir verde/vermelho
// sem necessidade real") - aqui a necessidade é real (aprovar/reprovar, o
// mesmo par semantico ja usado nos botoes por item da tabela abaixo).
// "Salvar" fica desabilitado: nao ha nenhum campo editavel nesta tela hoje
// que precise ser salvo (Observações/forma de pagamento/etc ainda não
// existem no backend - ver OS-pendentes-claude-code.md).
export function AprovarReprovarTudo({ pedidoId }: { pedidoId: string }) {
  const [estadoAprovar, acaoAprovar, pendingAprovar] = useActionState(
    aprovarTodosItens.bind(null, pedidoId),
    ESTADO_INICIAL,
  );
  const [estadoRejeitar, acaoRejeitar, pendingRejeitar] = useActionState(
    rejeitarTodosItens.bind(null, pedidoId),
    ESTADO_INICIAL,
  );

  const pending = pendingAprovar || pendingRejeitar;
  const erro = estadoAprovar.erro ?? estadoRejeitar.erro;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled
          title="Nenhum campo editável nesta tela ainda - ver OS-pendentes-claude-code.md"
          className="inline-flex items-center justify-center rounded-full bg-background px-5 py-2.5 text-sm font-medium text-muted opacity-60"
        >
          Salvar
        </button>
        <form action={acaoRejeitar}>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-full bg-accent-red px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
          >
            Reprovar tudo
          </button>
        </form>
        <form action={acaoAprovar}>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-full bg-accent-green px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
          >
            Aprovar tudo
          </button>
        </form>
      </div>
      {erro && <p className="text-xs font-medium text-accent-red">{erro}</p>}
    </div>
  );
}
