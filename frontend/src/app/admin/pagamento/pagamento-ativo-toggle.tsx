"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/design/switch";
import { atualizarAtivoCondicaoPagamento, atualizarAtivoFormaPagamento } from "./actions";

// Mesmo padrão otimista de AtivoToggle (admin/tipos-acondicionamento),
// só que com o visual de slide switch (pedido explícito do usuário) em
// vez de checkbox puro. Um componente só pros dois catálogos (forma e
// condição de pagamento) - a única diferença entre eles é qual Server
// Action chamar.
//
// O switch reflete/controla SEMPRE `!desativadaManualmente` (nunca o
// `ativo` efetivo, que também considera inativa no Radar/condição
// expirada - ver pagamento-response.dto.ts) - senão uma condição já
// expirada apareceria travada em "desligado" mesmo depois de ligar,
// porque o `ativo` recalculado no próximo carregamento continuaria
// false. O card mostra "Inativa no Radar"/"Expirada" à parte pra deixar
// claro que ligar o switch nesses casos não muda o estado efetivo hoje.
export function PagamentoAtivoToggle({
  id,
  tipo,
  permitidoInicial,
}: {
  id: string;
  tipo: "forma" | "condicao";
  permitidoInicial: boolean;
}) {
  const [ativo, setAtivo] = useState(permitidoInicial);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const atualizar = tipo === "forma" ? atualizarAtivoFormaPagamento : atualizarAtivoCondicaoPagamento;

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={ativo}
        disabled={pending}
        label={ativo ? "Ativo" : "Inativo"}
        onChange={(novoValor) => {
          setAtivo(novoValor);
          setErro(null);
          startTransition(async () => {
            try {
              await atualizar(id, novoValor);
            } catch {
              setAtivo(!novoValor);
              setErro("Falha ao salvar.");
            }
          });
        }}
      />
      <span className="text-xs text-muted">{ativo ? "Ativo" : "Inativo"}</span>
      {erro && <span className="text-xs text-ink">{erro}</span>}
    </div>
  );
}
