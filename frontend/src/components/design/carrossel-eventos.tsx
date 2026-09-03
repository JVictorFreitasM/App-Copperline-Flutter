import type { ReactNode } from "react";

// Carrossel automático contínuo (pedido do usuário: fica passando pro lado
// sozinho, sem parar, repetindo) - implementado com animação CSS pura (ver
// @keyframes carrossel-eventos em globals.css), não setInterval/JS: mais
// suave, sem jank de re-render, e continua rodando de graça mesmo com a
// aba desfocada. A lista é duplicada (itens + itens) e a animação anda de
// 0% até -50% - a segunda cópia começa exatamente onde a primeira termina,
// então o loop não tem salto perceptível. Server Component (sem "use
// client") - a animação é só CSS, não precisa de estado/efeito no cliente.
export function CarrosselEventos({ itens }: { itens: ReactNode[] }) {
  return (
    <div className="group overflow-hidden">
      <div className="flex w-max animate-carrossel-eventos gap-4 group-hover:[animation-play-state:paused]">
        {[...itens, ...itens].map((item, indice) => (
          <div key={indice} className="shrink-0">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
