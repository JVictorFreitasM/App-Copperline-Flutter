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

// Ícones da casca do app (sidebar/topbar, ver skill design-system) - mesmo
// padrão minimalista acima, adicionados junto com o AppShell.
export function IconeGrade() {
  return (
    <svg {...PROPS_BASE} aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconeCamadas() {
  return (
    <svg {...PROPS_BASE} aria-hidden="true">
      <path d="M12 3.5 20.5 8 12 12.5 3.5 8Z" />
      <path d="M3.5 12 12 16.5 20.5 12" />
      <path d="M3.5 16 12 20.5 20.5 16" />
    </svg>
  );
}

export function IconeRecibo() {
  return (
    <svg {...PROPS_BASE} aria-hidden="true">
      <path d="M6 3.5h12v17l-2.5-1.5-2 1.5-2-1.5-2 1.5-2-1.5-1.5 1.5Z" />
      <path d="M8.5 8h7" />
      <path d="M8.5 11.5h7" />
      <path d="M8.5 15h4" />
    </svg>
  );
}

export function IconeAtualizar() {
  return (
    <svg {...PROPS_BASE} aria-hidden="true">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v5h-5" />
    </svg>
  );
}

export function IconeEscudo() {
  return (
    <svg {...PROPS_BASE} aria-hidden="true">
      <path d="M12 3.5 19.5 6.5v5.5c0 4.5-3.2 7.6-7.5 8.5-4.3-.9-7.5-4-7.5-8.5V6.5Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function IconeUpload() {
  return (
    <svg {...PROPS_BASE} aria-hidden="true">
      <path d="M12 15.5V4.5" />
      <path d="m7.5 9 4.5-4.5L16.5 9" />
      <path d="M4.5 15.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function IconeCheck() {
  return (
    <svg {...PROPS_BASE} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.5 2.3 2.3 4.7-4.8" />
    </svg>
  );
}

export function IconeMapa() {
  return (
    <svg {...PROPS_BASE} aria-hidden="true">
      <path d="M9 4.5 4.5 6v13.5L9 18l6 1.5 4.5-1.5V4.5L15 6 9 4.5Z" />
      <path d="M9 4.5V18" />
      <path d="M15 6v13.5" />
    </svg>
  );
}

export function IconeCalendario() {
  return (
    <svg {...PROPS_BASE} aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 9.5h16" />
      <path d="M8 3v3.5" />
      <path d="M16 3v3.5" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

export function IconeGrafico() {
  return (
    <svg {...PROPS_BASE} aria-hidden="true">
      <path d="M4.5 20V10" />
      <path d="M12 20V4" />
      <path d="M19.5 20v-6.5" />
    </svg>
  );
}

export function IconeBusca() {
  return (
    <svg {...PROPS_BASE} aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.35-4.35" />
    </svg>
  );
}

export function IconeSino() {
  return (
    <svg {...PROPS_BASE} aria-hidden="true">
      <path d="M6 10.5a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14.5 6 10.5Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconePino() {
  return (
    <svg {...PROPS_BASE} aria-hidden="true">
      <path d="M12 2.5 12 8" />
      <path d="M8 8h8l1.5 6h-11L8 8Z" />
      <path d="M12 14v7.5" />
    </svg>
  );
}

export function IconeMenu() {
  return (
    <svg {...PROPS_BASE} aria-hidden="true">
      <path d="M4 6.5h16" />
      <path d="M4 12h16" />
      <path d="M4 17.5h16" />
    </svg>
  );
}
