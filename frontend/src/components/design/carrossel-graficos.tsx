"use client";

import { useState, type ReactNode } from "react";
import { Card } from "./card";

// Carrossel manual (pedido do usuário: "não passa automaticamente, apenas
// ao selecionar") - troca de painel só via clique na aba ou no indicador,
// nunca por timer. Client Component só por causa do useState de seleção -
// os dados/gráficos em si continuam vindo prontos via prop, buscados no
// Server Component (painel/page.tsx), igual todo outro gráfico da tela.
export interface PainelCarrossel {
  titulo: string;
  legenda?: ReactNode;
  conteudo: ReactNode;
}

export function CarrosselGraficos({ paineis }: { paineis: PainelCarrossel[] }) {
  const [indice, setIndice] = useState(0);
  const atual = paineis[indice];

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {paineis.map((painel, i) => (
            <button
              key={painel.titulo}
              type="button"
              onClick={() => setIndice(i)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                i === indice ? "bg-primary text-white" : "bg-badge text-muted hover:text-ink"
              }`}
            >
              {painel.titulo}
            </button>
          ))}
        </div>
        {atual.legenda}
      </div>

      {atual.conteudo}

      <div className="mt-4 flex items-center justify-center gap-2">
        {paineis.map((painel, i) => (
          <button
            key={painel.titulo}
            type="button"
            aria-label={`Ver ${painel.titulo}`}
            onClick={() => setIndice(i)}
            className={`h-2 rounded-full transition-all ${
              i === indice ? "w-6 bg-primary" : "w-2 bg-badge"
            }`}
          />
        ))}
      </div>
    </Card>
  );
}
