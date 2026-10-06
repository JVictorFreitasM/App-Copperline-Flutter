import type { ReactNode } from "react";

// Campo de texto no padrão do projeto (rounded-full bg-background, mesmas
// classes de adicionar-contato-popup.tsx) - rótulo pequeno acima, como nas
// telas de referência do cadastro de cliente.
export function Campo({
  label,
  value,
  onChange,
  placeholder,
  className = "",
  type = "text",
  inputMode,
  maxLength,
  disabled = false,
  autoFocus = false,
  onBlur,
  dica,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  className?: string;
  type?: "text" | "email" | "date";
  inputMode?: "text" | "numeric" | "decimal" | "email" | "tel";
  maxLength?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
  dica?: ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-muted ${className}`}>
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        disabled={disabled}
        autoFocus={autoFocus}
        onBlur={onBlur}
        onChange={(evento) => onChange(evento.target.value)}
        className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-primary-light disabled:opacity-50"
      />
      {dica}
    </label>
  );
}

export function CampoSelect({
  label,
  value,
  onChange,
  children,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-muted ${className}`}>
      {label}
      <select
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
      >
        {children}
      </select>
    </label>
  );
}

export function MensagemErro({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium text-ink">{children}</p>;
}
