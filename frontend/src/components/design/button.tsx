import Link from "next/link";
import type { ReactNode } from "react";

// PrimaryButton (preto/ink, texto branco) e SecondaryButton (branco/surface,
// texto ink) - mesmo raio (pill), unica acao primaria por tela geralmente
// (ver skill design-system, "Botão primário"/"Botão/chip secundário").
// Aceita `href` (vira link de navegação) ou nao (vira <button>) - cobre os
// dois usos reais do projeto (links de navegação estilizados como botão,
// botões de submit de formulário) sem repassar todo o conjunto de props
// HTML que nenhuma tela precisa hoje.
interface BotaoProps {
  children: ReactNode;
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-40";

export function PrimaryButton({
  children,
  href,
  type = "button",
  disabled,
  className = "",
}: BotaoProps) {
  const classes = `${BASE} bg-ink text-white hover:opacity-90 ${className}`;
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  href,
  type = "button",
  disabled,
  className = "",
}: BotaoProps) {
  const classes = `${BASE} bg-surface text-ink shadow-sm hover:opacity-80 ${className}`;
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}
