import type { ReactNode } from "react";

// Card branco flutuando sobre o fundo (background) - sem borda visível, a
// separação vem de superfície + sombra suave, nunca de linha (ver skill
// design-system, "Cards brancos flutuando sobre fundo cinza claro").
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-card bg-surface p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
