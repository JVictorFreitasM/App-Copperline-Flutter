"use client";

import { useState, type ReactNode } from "react";
import { IconeChevronDireita } from "./icons";

export interface ItemSanfona {
  id: string;
  titulo: string;
  // Texto curto ao lado do titulo (ex: contagem) - visivel mesmo fechado.
  resumo?: ReactNode;
  conteudo: ReactNode;
}

// Sanfona vertical: um painel aberto por vez (abrir um fecha o outro). O
// conteudo so e' montado enquanto aberto - necessario pro mapa (Leaflet nao
// inicializa direito dentro de um container escondido, com tamanho zero) e
// poupa render dos graficos fechados. Os dados continuam vindo prontos do
// Server Component; aqui so ha o estado de qual painel esta aberto.
export function Sanfona({ itens, abertoInicial }: { itens: ItemSanfona[]; abertoInicial?: string | null }) {
  const [aberto, setAberto] = useState<string | null>(abertoInicial ?? null);

  return (
    <div className="flex flex-col gap-3">
      {itens.map((item) => {
        const estaAberto = aberto === item.id;
        return (
          <section key={item.id} className="rounded-card bg-surface shadow-sm">
            <button
              type="button"
              aria-expanded={estaAberto}
              aria-controls={`sanfona-${item.id}`}
              onClick={() => setAberto(estaAberto ? null : item.id)}
              className="flex w-full items-center gap-3 px-5 py-4 text-left"
            >
              <span
                className={`shrink-0 text-muted transition-transform duration-200 ${estaAberto ? "rotate-90" : ""}`}
              >
                <IconeChevronDireita />
              </span>
              <h2 className="flex-1 text-lg font-semibold text-ink">{item.titulo}</h2>
              {item.resumo && <span className="text-sm text-muted">{item.resumo}</span>}
            </button>
            {estaAberto && (
              <div id={`sanfona-${item.id}`} className="flex flex-col gap-3 border-t border-ink/5 px-5 py-5">
                {item.conteudo}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
