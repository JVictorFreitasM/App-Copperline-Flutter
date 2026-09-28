"use client";

import { useState } from "react";
import { Modal } from "@/components/design/modal";

// Botao "Exportar PDF" do pedido inteiro (pedido do usuario, 2026-09-28) -
// mesmo padrao de busca-antes-de-abrir de LinkPdfNotaFiscal (evita abrir
// aba nova so com JSON cru de erro quando a geracao falha no backend).
export function BotaoExportarPdfPedido({ pedidoId }: { pedidoId: string }) {
  const [carregando, setCarregando] = useState(false);
  const [erroAberto, setErroAberto] = useState(false);

  async function exportar() {
    setCarregando(true);
    try {
      const resposta = await fetch(`/api/pedidos/${pedidoId}/pdf`, {
        cache: "no-store",
      });

      if (!resposta.ok) {
        setErroAberto(true);
        return;
      }

      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setErroAberto(true);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={exportar}
        disabled={carregando}
        className="ml-auto rounded-full bg-solid px-4 py-2 text-xs font-medium text-on-solid transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
      >
        {carregando ? "Gerando PDF…" : "Exportar PDF"}
      </button>

      <Modal
        open={erroAberto}
        onClose={() => setErroAberto(false)}
        title="Não foi possível gerar o PDF"
        largura="max-w-md"
      >
        <p className="text-sm text-ink">
          Não foi possível gerar o PDF deste pedido agora. Tente novamente em instantes; se o
          problema continuar, avise o time de TI.
        </p>
      </Modal>
    </>
  );
}
