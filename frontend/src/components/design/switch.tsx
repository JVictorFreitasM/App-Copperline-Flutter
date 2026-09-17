"use client";

// Slide toggle switch (trilho + thumb deslizante) - mesmos dois tons do
// resto do design system (Badge/ver skill design-system: preto para
// destaque/ligado, cinza neutro para desligado, sem verde/vermelho
// decorativo). Componente burro: quem chama controla estado/pending/erro
// (mesmo padrão de AtivoToggle/PermiteCheckinToggle, que hoje usam
// checkbox puro - este é o primeiro caso que precisa do visual de slide).
export function Switch({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (valor: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-ink" : "bg-background border border-badge"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-surface shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
