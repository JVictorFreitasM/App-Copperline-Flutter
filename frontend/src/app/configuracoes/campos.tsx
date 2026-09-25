"use client";

import type { ReactNode } from "react";

// Linha padrão das 3 abas de Configurações (título em negrito + descrição
// em cinza à esquerda, controle à direita) - mesmo layout das 3 imagens de
// referência (config-aba-*.jpg).
export function LinhaConfiguracao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-5 first:pt-0 last:pb-0">
      <div className="max-w-xl">
        <p className="text-sm font-semibold text-ink">{titulo}</p>
        <p className="mt-1 text-xs text-muted">{descricao}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function CampoPercentual({
  valor,
  disabled,
  onChange,
}: {
  valor: number;
  disabled?: boolean;
  onChange: (valor: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={100}
        step="1"
        value={valor}
        disabled={disabled}
        onChange={(evento) => onChange(Number(evento.target.value))}
        className="w-20 rounded-full bg-background px-3 py-1.5 text-right text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
      />
      <span className="text-sm text-muted">%</span>
    </div>
  );
}

export function CampoInteiro({
  valor,
  disabled,
  min,
  placeholder,
  onChange,
}: {
  valor: number | null;
  disabled?: boolean;
  min?: number;
  placeholder?: string;
  onChange: (valor: number | null) => void;
}) {
  return (
    <input
      type="number"
      min={min}
      step="1"
      value={valor ?? ""}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(evento) => {
        const texto = evento.target.value;
        onChange(texto === "" ? null : Number(texto));
      }}
      className="w-28 rounded-full bg-background px-3 py-1.5 text-right text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
    />
  );
}

export function CampoTexto({
  valor,
  disabled,
  placeholder,
  onChange,
}: {
  valor: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (valor: string) => void;
}) {
  return (
    <input
      type="text"
      value={valor}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(evento) => onChange(evento.target.value)}
      className="w-56 rounded-full bg-background px-3 py-1.5 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
    />
  );
}

export function CampoHorario({
  valor,
  disabled,
  onChange,
}: {
  valor: string;
  disabled?: boolean;
  onChange: (valor: string) => void;
}) {
  return (
    <input
      type="time"
      value={valor}
      disabled={disabled}
      onChange={(evento) => onChange(evento.target.value)}
      className="rounded-full bg-background px-3 py-1.5 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
    />
  );
}

// Barra fixa no rodapé da aba, só aparece quando há alteração não salva -
// evita PATCH a cada clique de switch (os 3 endpoints exigem todos os
// campos da aba no mesmo PATCH, ver actions.ts).
export function RodapeSalvar({
  visivel,
  pending,
  erro,
  sucesso,
  onSalvar,
}: {
  visivel: boolean;
  pending: boolean;
  erro: string | null;
  sucesso: boolean;
  onSalvar: () => void;
}) {
  if (!visivel && !sucesso && !erro) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-3 pt-5">
      {erro && <span className="text-xs text-ink">{erro}</span>}
      {!erro && sucesso && !visivel && (
        <span className="text-xs text-muted">Alterações salvas.</span>
      )}
      {visivel && (
        <button
          type="button"
          disabled={pending}
          onClick={onSalvar}
          className="rounded-full bg-solid px-5 py-2 text-sm font-medium text-on-solid transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Salvar alterações"}
        </button>
      )}
    </div>
  );
}
