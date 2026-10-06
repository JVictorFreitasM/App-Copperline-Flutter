"use client";

import { useState } from "react";
import { formatarTelefone, telefoneEhValido, type TelefoneInput } from "@/lib/cadastro-cliente";
import { SecondaryButton } from "@/components/design/button";
import { Campo, MensagemErro } from "./campos";

// Lista de telefones com "Adicionar telefone" (botão da tela de referência):
// abre DDD + número, valida (DDD 2 dígitos, número 8/9) e entra na lista.
// `max` limita quantos (o popup de contato aceita só 1 no cadastro do Radar).
export function CampoTelefones({
  telefones,
  onChange,
  max = 5,
}: {
  telefones: TelefoneInput[];
  onChange: (telefones: TelefoneInput[]) => void;
  max?: number;
}) {
  const [adicionando, setAdicionando] = useState(false);
  const [ddd, setDdd] = useState("");
  const [numero, setNumero] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function confirmar() {
    const novo = { ddd: ddd.replace(/\D/g, ""), numero: numero.replace(/\D/g, "") };
    if (!telefoneEhValido(novo)) {
      setErro("Informe DDD (2 dígitos) e número (8 ou 9 dígitos).");
      return;
    }
    onChange([...telefones, novo]);
    setDdd("");
    setNumero("");
    setErro(null);
    setAdicionando(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {telefones.map((telefone, indice) => (
          <span
            key={`${telefone.ddd}${telefone.numero}`}
            className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-sm text-ink"
          >
            {formatarTelefone(telefone)}
            <button
              type="button"
              aria-label={`Remover telefone ${formatarTelefone(telefone)}`}
              onClick={() => onChange(telefones.filter((_, i) => i !== indice))}
              className="text-xs text-muted hover:text-ink"
            >
              ✕
            </button>
          </span>
        ))}
        {!adicionando && telefones.length < max && (
          <SecondaryButton onClick={() => setAdicionando(true)} className="!px-3 !py-1.5 !text-xs">
            Adicionar telefone
          </SecondaryButton>
        )}
      </div>

      {adicionando && (
        <div className="flex flex-wrap items-end gap-2">
          <Campo label="DDD" value={ddd} onChange={setDdd} className="w-20" inputMode="numeric" maxLength={2} autoFocus />
          <Campo label="Número" value={numero} onChange={setNumero} className="w-40" inputMode="tel" maxLength={10} />
          <SecondaryButton onClick={confirmar}>Adicionar</SecondaryButton>
          <button
            type="button"
            onClick={() => {
              setAdicionando(false);
              setErro(null);
            }}
            className="px-1 pb-2 text-sm text-muted hover:text-ink"
          >
            Cancelar
          </button>
        </div>
      )}
      {erro && <MensagemErro>{erro}</MensagemErro>}
    </div>
  );
}
