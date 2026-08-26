"use client";

import { useState } from "react";

const BASE_BOTAO =
  "inline-flex items-center justify-center gap-2 rounded-full bg-surface px-5 py-2.5 text-sm font-medium text-ink shadow-sm transition hover:opacity-80";

// Revela a foto do check-in só sob demanda (OS-WEB-26) - a lista pode ter
// até 20 visitas por página, várias com foto (fotos de câmera de celular,
// potencialmente alguns MB cada); carregar todas de uma vez sem o
// supervisor ter pedido seria desperdício de banda real, não só estética.
// Client Component mínimo só pelo estado local "mostrar ou não" - a busca
// em si acontece via <img src> normal (repassa pro Route Handler local,
// ver app/api/visitas/[id]/foto/route.ts), sem fetch() manual.
export function FotoVisita({ visitaId }: { visitaId: string }) {
  const [mostrar, setMostrar] = useState(false);

  if (!mostrar) {
    return (
      <button type="button" onClick={() => setMostrar(true)} className={BASE_BOTAO}>
        Ver foto do check-in
      </button>
    );
  }

  return (
    // foto vem de uma API route dinamica (dimensoes variaveis, foto de
    // camera de celular), sem beneficio real do otimizador de next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/visitas/${visitaId}/foto`}
      alt="Foto da fachada tirada no check-in"
      className="max-h-96 w-full rounded-card object-contain"
    />
  );
}
