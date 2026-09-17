"use client";

import { useEffect, type ReactNode } from "react";

// Primeiro Modal/Dialog do projeto (unificacao da tela de criar pedido com
// popups de item/tabela/contato, referencia do usuario) - mesma linguagem
// visual do Card (rounded-card bg-surface shadow-sm), sem lib de terceiros
// (nenhuma no projeto pra isso). Componente burro: quem chama controla
// `open` (mesmo criterio "burro" do Switch) - Escape fecha, clique no
// overlay fecha, sem focus-trap (nenhuma lib disponivel pra isso aqui).
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  largura = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  largura?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(evento: KeyboardEvent) {
      if (evento.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(evento) => evento.stopPropagation()}
        className={`flex max-h-[90vh] w-full ${largura} flex-col rounded-card bg-surface shadow-sm`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line p-6 pb-4">
          {title && <h2 className="text-lg font-semibold text-ink">{title}</h2>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="ml-auto text-sm text-muted hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-6 pt-4">{children}</div>
        {footer && <div className="border-t border-line p-6 pt-4">{footer}</div>}
      </div>
    </div>
  );
}

// Rodape padrao Cancelar/Confirmar (mesmas classes de botao ja usadas em
// criar-pedido-form.tsx) - opcional, quem chama pode passar footer custom.
export function ModalFooter({
  onCancelar,
  onConfirmar,
  rotuloConfirmar = "Confirmar",
  confirmarDesabilitado = false,
}: {
  onCancelar: () => void;
  onConfirmar: () => void;
  rotuloConfirmar?: string;
  confirmarDesabilitado?: boolean;
}) {
  return (
    <div className="flex justify-end gap-3">
      <button
        type="button"
        onClick={onCancelar}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-surface px-5 py-2.5 text-sm font-medium text-ink shadow-sm transition hover:opacity-80"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onConfirmar}
        disabled={confirmarDesabilitado}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
      >
        {rotuloConfirmar}
      </button>
    </div>
  );
}
