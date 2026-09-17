"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/design/modal";
import { listarTabelasPrecoCliente } from "./actions";

// Abre automaticamente ao selecionar o cliente (decisão confirmada com o
// usuário - não é mais um botão "Configurações" solto). 1 tabela
// associada = auto-seleciona e fecha sozinho (mesma regra "fixa" já usada
// em TabelasPrecoCliente, admin); 2+ = pede pra escolher.
export function TabelaPrecoPopup({
  open,
  clienteId,
  onFechar,
  onSelecionar,
}: {
  open: boolean;
  clienteId: string | null;
  onFechar: () => void;
  onSelecionar: (codigo: string) => void;
}) {
  const [codigos, setCodigos] = useState<string[] | null>(null);

  useEffect(() => {
    if (!open || !clienteId) return;
    setCodigos(null);
    listarTabelasPrecoCliente(clienteId).then((resultado) => {
      setCodigos(resultado);
      if (resultado.length === 1) {
        onSelecionar(resultado[0]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clienteId]);

  // Fecha sozinho quando so' ha' 1 opção (auto-selecionada acima) ou
  // nenhuma (nada pra escolher) - só fica aberto de fato quando há 2+.
  useEffect(() => {
    if (codigos !== null && codigos.length <= 1) {
      onFechar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigos]);

  if (!open || codigos === null || codigos.length <= 1) return null;

  return (
    <Modal open={open} onClose={onFechar} title="Tabela de preços">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted">
          Este cliente tem mais de uma tabela associada - escolha qual usar neste pedido.
        </p>
        {codigos.map((codigo) => (
          <button
            key={codigo}
            type="button"
            onClick={() => {
              onSelecionar(codigo);
              onFechar();
            }}
            className="rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-background"
          >
            {codigo}
          </button>
        ))}
      </div>
    </Modal>
  );
}
