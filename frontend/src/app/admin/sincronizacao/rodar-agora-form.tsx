"use client";

import { useActionState } from "react";
import { SecondaryButton } from "@/components/design/button";
import { rodarAgora } from "./actions";
import type { EstadoSync } from "./actions";

const ESTADO_INICIAL: EstadoSync = { erro: null, sucesso: null };

// Client component isolado (OS-WEB-28) - ver comentario em actions.ts.
export function RodarAgoraForm({ nomeEntidade }: { nomeEntidade: string }) {
  const [estado, acao, pending] = useActionState(
    rodarAgora.bind(null, nomeEntidade),
    ESTADO_INICIAL,
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={acao}>
        <SecondaryButton type="submit" disabled={pending}>
          Rodar agora
        </SecondaryButton>
      </form>
      {estado.sucesso && <p className="text-xs font-medium text-ink">{estado.sucesso}</p>}
      {estado.erro && <p className="text-xs font-medium text-muted">{estado.erro}</p>}
    </div>
  );
}
