"use client";

import { useActionState } from "react";
import { SecondaryButton } from "@/components/design/button";
import { removerDocumento, ESTADO_REMOCAO_INICIAL } from "./actions";

// Client Component isolado por linha (mesmo padrão de rodar-agora-form.tsx)
// - .bind(null, id) fecha o id do documento antes de virar a assinatura
// (estadoAnterior, formData) que useActionState espera. "Substituir" não
// tem endpoint dedicado (ver actions.ts/backend) - é remover + novo upload
// pelo formulário acima.
export function RemoverDocumentoForm({ id }: { id: string }) {
  const [estado, acao, pending] = useActionState(
    removerDocumento.bind(null, id),
    ESTADO_REMOCAO_INICIAL,
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form
        action={acao}
        onSubmit={(evento) => {
          if (!confirm("Remover este documento? A ação não pode ser desfeita.")) {
            evento.preventDefault();
          }
        }}
      >
        <SecondaryButton type="submit" disabled={pending}>
          {pending ? "Removendo..." : "Remover"}
        </SecondaryButton>
      </form>
      {estado.erro && <p className="text-xs font-medium text-muted">{estado.erro}</p>}
    </div>
  );
}
