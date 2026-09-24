"use client";

import { useState, useTransition } from "react";
import { atualizarRankingVisivelParaVendedor } from "./actions";

// Mesmo padrao de PermiteCheckinToggle (admin/vendedores/permite-checkin-toggle.tsx) -
// checkbox chamando a Server Action direto, estado otimista revertido se falhar.
export function RankingVisivelToggle({ visivelInicial }: { visivelInicial: boolean }) {
  const [visivel, setVisivel] = useState(visivelInicial);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        checked={visivel}
        disabled={pending}
        onChange={(evento) => {
          const novoValor = evento.target.checked;
          setVisivel(novoValor);
          setErro(null);
          startTransition(async () => {
            try {
              await atualizarRankingVisivelParaVendedor(novoValor);
            } catch {
              setVisivel(!novoValor);
              setErro("Falha ao salvar - tente novamente.");
            }
          });
        }}
      />
      Ranking visível pra vendedor comum (colegas da mesma equipe)
      {erro && <span className="text-xs text-muted">{erro}</span>}
    </label>
  );
}
