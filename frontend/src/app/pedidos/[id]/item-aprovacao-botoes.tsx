"use client";

import { useActionState } from "react";
import { IconeCheck, IconeX } from "@/components/design/icons";
import { aprovarItem, rejeitarItem } from "./actions";
import type { EstadoDecisaoItem } from "./actions";

const ESTADO_INICIAL: EstadoDecisaoItem = { erro: null };

// X vermelho / check verde por item (layout de referencia ref1.jpeg) - cor
// preenchida so quando aquele e' o status ATUAL do item (statusAprovacao),
// o outro botao fica so com contorno - mesmo criterio visual de "estado
// selecionado" usado em toggles do resto do projeto.
export function ItemAprovacaoBotoes({
  pedidoId,
  itemId,
  statusAprovacao,
}: {
  pedidoId: string;
  itemId: string;
  statusAprovacao: "PENDENTE" | "APROVADO" | "REJEITADO";
}) {
  const [estadoRejeitar, acaoRejeitar, pendingRejeitar] = useActionState(
    rejeitarItem.bind(null, pedidoId, itemId),
    ESTADO_INICIAL,
  );
  const [estadoAprovar, acaoAprovar, pendingAprovar] = useActionState(
    aprovarItem.bind(null, pedidoId, itemId),
    ESTADO_INICIAL,
  );

  const pending = pendingRejeitar || pendingAprovar;
  const erro = estadoRejeitar.erro ?? estadoAprovar.erro;
  const rejeitado = statusAprovacao === "REJEITADO";
  const aprovado = statusAprovacao === "APROVADO";

  return (
    <div className="flex items-center gap-1.5" title={erro ?? undefined}>
      <form action={acaoRejeitar}>
        <button
          type="submit"
          disabled={pending}
          aria-label="Recusar item"
          aria-pressed={rejeitado}
          className={`flex h-7 w-7 items-center justify-center rounded-full transition disabled:pointer-events-none disabled:opacity-40 ${
            rejeitado
              ? "bg-accent-red text-white"
              : "bg-accent-red-light text-accent-red hover:opacity-80"
          }`}
        >
          <IconeX />
        </button>
      </form>
      <form action={acaoAprovar}>
        <button
          type="submit"
          disabled={pending}
          aria-label="Aceitar item"
          aria-pressed={aprovado}
          className={`flex h-7 w-7 items-center justify-center rounded-full transition disabled:pointer-events-none disabled:opacity-40 ${
            aprovado
              ? "bg-accent-green text-white"
              : "bg-accent-green-light text-accent-green hover:opacity-80"
          }`}
        >
          <IconeCheck />
        </button>
      </form>
    </div>
  );
}
