"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SecondaryButton } from "@/components/design/button";
import { reenviarMensagem } from "./mensagens-actions";

// Reenvia uma mensagem já enviada (mesmo conteúdo e destino; os
// destinatários são resolvidos de novo agora). Pede confirmação antes - o
// push chega no celular de todo mundo e não tem como desfazer, então um
// clique acidental ou duplo não pode disparar sozinho.
export function ReenviarButton({
  mensagemId,
  assunto,
  destinoRotulo,
}: {
  mensagemId: string;
  assunto: string;
  destinoRotulo: string;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function reenviar() {
    if (!window.confirm(`Reenviar "${assunto}" para ${destinoRotulo}?`)) return;
    setFeedback(null);
    startTransition(async () => {
      const resultado = await reenviarMensagem(mensagemId);
      if (!resultado.ok) {
        setFeedback({ tipo: "erro", texto: resultado.erro });
        return;
      }
      const { totalDestinatarios, semAppVinculado } = resultado.dados;
      setFeedback({
        tipo: "ok",
        texto:
          `Reenviada para ${totalDestinatarios} ${totalDestinatarios === 1 ? "pessoa" : "pessoas"}.` +
          (semAppVinculado > 0 ? ` ${semAppVinculado} sem app vinculado ficaram de fora.` : ""),
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <SecondaryButton type="button" disabled={pending} onClick={reenviar}>
        {pending ? "Reenviando..." : "Reenviar"}
      </SecondaryButton>
      {feedback && (
        <p
          role="status"
          className={`max-w-xs text-right text-xs ${feedback.tipo === "ok" ? "text-accent-green" : "text-accent-red"}`}
        >
          {feedback.texto}
        </p>
      )}
    </div>
  );
}
