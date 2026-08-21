// Ícones de linha minimalistas (SVG inline, sem dependência nova) - usados
// nos StatCard do dashboard. Sem preenchimento, herdam a cor do texto
// (currentColor), consistente com o resto do design system.
const PROPS_BASE = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconePessoas() {
  return (
    <svg {...PROPS_BASE} aria-hidden="true">
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 20c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" />
      <path d="M16 8.5a2.75 2.75 0 1 0 0-5.5" />
      <path d="M18.5 14.5c2.485 0 4.5 2.239 4.5 5" />
    </svg>
  );
}

export function IconeCaixa() {
  return (
    <svg {...PROPS_BASE} aria-hidden="true">
      <path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16Z" />
      <path d="M3.5 8 12 12.5 20.5 8" />
      <path d="M12 12.5V20.5" />
    </svg>
  );
}

export function IconeClipboard() {
  return (
    <svg {...PROPS_BASE} aria-hidden="true">
      <rect x="5.5" y="4.5" width="13" height="16" rx="2" />
      <path d="M9 4.5V3.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M8.5 11h7" />
      <path d="M8.5 15h5" />
    </svg>
  );
}

export function IconeMoeda() {
  return (
    <svg {...PROPS_BASE} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9" />
      <path d="M14.5 9.75c0-1.1-1.12-2-2.5-2s-2.5.75-2.5 1.85c0 2.9 5 1.4 5 4.3 0 1.1-1.12 1.85-2.5 1.85s-2.5-.9-2.5-2" />
    </svg>
  );
}
