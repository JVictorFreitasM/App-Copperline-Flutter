"use client";

import { useState, useTransition } from "react";
import { atualizarWhatsappVendedor } from "./actions";

// Cadastro manual (2026-09-28) - mesmo padrao de estado local otimista de
// PermiteCheckinToggle, so que com input de texto (numero de WhatsApp) em
// vez de checkbox.
export function WhatsappForm({
  vendedorId,
  whatsappInicial,
}: {
  vendedorId: string;
  whatsappInicial: string | null;
}) {
  const [whatsapp, setWhatsapp] = useState(whatsappInicial ?? "");
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  function salvar() {
    setErro(null);
    setSucesso(false);
    startTransition(async () => {
      try {
        await atualizarWhatsappVendedor(vendedorId, whatsapp.trim());
        setSucesso(true);
      } catch {
        setErro("Falha ao salvar - tente novamente.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <label className="text-muted" htmlFor={`whatsapp-${vendedorId}`}>
        WhatsApp
      </label>
      <input
        id={`whatsapp-${vendedorId}`}
        type="text"
        value={whatsapp}
        disabled={pending}
        placeholder="(86) 98802-9295"
        onChange={(evento) => setWhatsapp(evento.target.value)}
        className="w-40 rounded-full bg-background px-3 py-1.5 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
      />
      <button
        type="button"
        disabled={pending || whatsapp.trim() === (whatsappInicial ?? "")}
        onClick={salvar}
        className="rounded-full bg-solid px-3 py-1.5 text-xs font-medium text-on-solid transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Salvando..." : "Salvar"}
      </button>
      {erro && <span className="text-ink">{erro}</span>}
      {sucesso && !erro && <span className="text-muted">Salvo.</span>}
    </div>
  );
}
