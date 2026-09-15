"use client";

import { useState, useTransition } from "react";
import { atualizarAtivoTipoAcondicionamento } from "./actions";

// Mesmo padrão de PermiteCheckinToggle (admin/vendedores) - checkbox
// chamando a Server Action direto, estado otimista revertido em falha.
export function AtivoToggle({ tipoId, ativoInicial }: { tipoId: string; ativoInicial: boolean }) {
  const [ativo, setAtivo] = useState(ativoInicial);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <input
        type="checkbox"
        checked={ativo}
        disabled={pending}
        onChange={(evento) => {
          const novoValor = evento.target.checked;
          setAtivo(novoValor);
          setErro(null);
          startTransition(async () => {
            try {
              await atualizarAtivoTipoAcondicionamento(tipoId, novoValor);
            } catch {
              setAtivo(!novoValor);
              setErro("Falha ao salvar.");
            }
          });
        }}
      />
      Ativo
      {erro && <span className="text-ink">{erro}</span>}
    </label>
  );
}
