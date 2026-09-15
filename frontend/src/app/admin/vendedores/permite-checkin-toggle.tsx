"use client";

import { useState, useTransition } from "react";
import { atualizarPermiteCheckinSemAgendamento } from "./actions";

// OS-novas-implementacoes.md Bloco 5 - checkbox chamando a Server Action
// direto (sem <form>/useActionState, ver comentário em actions.ts) -
// estado otimista local (useState) evita esperar o round-trip pra
// refletir o clique, revertido se a chamada falhar.
export function PermiteCheckinToggle({
  vendedorId,
  permiteInicial,
}: {
  vendedorId: string;
  permiteInicial: boolean;
}) {
  const [permite, setPermite] = useState(permiteInicial);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <input
        type="checkbox"
        checked={permite}
        disabled={pending}
        onChange={(evento) => {
          const novoValor = evento.target.checked;
          setPermite(novoValor);
          setErro(null);
          startTransition(async () => {
            try {
              await atualizarPermiteCheckinSemAgendamento(vendedorId, novoValor);
            } catch {
              setPermite(!novoValor);
              setErro("Falha ao salvar - tente novamente.");
            }
          });
        }}
      />
      Permite check-in sem agendamento
      {erro && <span className="text-ink">{erro}</span>}
    </label>
  );
}
