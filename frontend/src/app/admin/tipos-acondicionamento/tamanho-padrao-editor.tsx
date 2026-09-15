"use client";

import { useState, useTransition } from "react";
import { atualizarTamanhoPadraoTipoAcondicionamento } from "./actions";

// Edicao inline do tamanho padrao de um tipo ja cadastrado - vazio salva
// como null (retalho), mesmo criterio de "campo vazio = retalho" do
// formulario de criacao (criar-tipo-form.tsx). Mesmo padrao otimista de
// AtivoToggle (useTransition, reverte em falha).
export function TamanhoPadraoEditor({
  tipoId,
  tamanhoPadraoInicial,
}: {
  tipoId: string;
  tamanhoPadraoInicial: string | null;
}) {
  const [valor, setValor] = useState(tamanhoPadraoInicial ?? "");
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function salvar() {
    const texto = valor.trim();
    const numero = texto ? Number(texto) : null;
    if (texto && (Number.isNaN(numero) || (numero ?? 0) <= 0)) {
      setErro("Precisa ser um número maior que zero.");
      return;
    }
    setErro(null);
    const valorAnterior = valor;
    startTransition(async () => {
      try {
        await atualizarTamanhoPadraoTipoAcondicionamento(tipoId, numero);
      } catch {
        setValor(valorAnterior);
        setErro("Falha ao salvar.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <label className="flex items-center gap-1">
        Tamanho padrão (m):
        <input
          type="number"
          step="0.001"
          min="0"
          value={valor}
          disabled={pending}
          placeholder="retalho"
          onChange={(evento) => setValor(evento.target.value)}
          onBlur={salvar}
          className="w-24 rounded-full bg-background px-3 py-1 text-xs text-ink outline-none focus:ring-2 focus:ring-primary-light"
        />
      </label>
      {erro && <span className="text-ink">{erro}</span>}
    </div>
  );
}
