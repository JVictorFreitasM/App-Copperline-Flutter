"use client";

import { useState, useTransition } from "react";
import { Modal, ModalFooter } from "@/components/design/modal";
import type { SolicitacaoDescontoDoPedidoDto } from "@/lib/pedidos";
import { decidirDescontoPedido } from "./actions";

type Acao = "aprovar" | "rejeitar";

const ROTULO_STATUS = {
  PENDENTE: "Aguardando decisão",
  APROVADO: "Desconto aprovado",
  REJEITADO: "Desconto rejeitado",
} as const;

// Aceitar/recusar o desconto do pedido (layout de referencia ref1.jpeg) -
// so renderizado quando o pedido TEM solicitacao de desconto (ver page.tsx).
// Fluxo: clique -> popup de confirmacao -> decisao -> botoes inativos. Os
// botoes ja nascem inativos se a solicitacao nao esta mais PENDENTE ou se o
// usuario logado nao pode decidi-la (podeDecidir, vindo do backend).
// Cores vermelho/verde sao excecao deliberada a paleta neutra (ver skill
// design-system): aqui e' aprovar/reprovar de verdade.
export function AprovarReprovarTudo({
  pedidoId,
  solicitacao,
}: {
  pedidoId: string;
  solicitacao: SolicitacaoDescontoDoPedidoDto;
}) {
  const [acaoPendente, setAcaoPendente] = useState<Acao | null>(null);
  const [decididoAgora, setDecididoAgora] = useState<"APROVADO" | "REJEITADO" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, iniciarTransicao] = useTransition();

  const status = decididoAgora ?? solicitacao.status;
  const decidido = status !== "PENDENTE";
  const inativo = decidido || !solicitacao.podeDecidir || processando;

  function confirmar() {
    if (!acaoPendente) return;
    const acao = acaoPendente;
    iniciarTransicao(async () => {
      const resultado = await decidirDescontoPedido(pedidoId, solicitacao.id, acao);
      setAcaoPendente(null);
      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }
      setErro(null);
      setDecididoAgora(resultado.decidido);
    });
  }

  const textoDesconto = `${solicitacao.percentualSolicitado}% de desconto`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">
          {ROTULO_STATUS[status]} ({textoDesconto}
          {solicitacao.aprovadorEsperadoNome && !decidido
            ? ` - aprovador: ${solicitacao.aprovadorEsperadoNome}`
            : ""}
          )
        </span>
        <button
          type="button"
          disabled={inativo}
          onClick={() => setAcaoPendente("rejeitar")}
          className="inline-flex items-center justify-center rounded-full bg-accent-red px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
        >
          Recusar desconto
        </button>
        <button
          type="button"
          disabled={inativo}
          onClick={() => setAcaoPendente("aprovar")}
          className="inline-flex items-center justify-center rounded-full bg-accent-green px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
        >
          Aceitar desconto
        </button>
      </div>
      {!decidido && !solicitacao.podeDecidir && (
        <p className="text-xs text-muted">
          Só quem tem alçada ({solicitacao.papelExigido.toLowerCase()} ou superior) pode decidir
          este desconto.
        </p>
      )}
      {erro && <p className="text-xs font-medium text-accent-red">{erro}</p>}

      <Modal
        open={acaoPendente !== null}
        onClose={() => !processando && setAcaoPendente(null)}
        title={acaoPendente === "aprovar" ? "Aceitar desconto" : "Recusar desconto"}
        footer={
          <ModalFooter
            onCancelar={() => setAcaoPendente(null)}
            onConfirmar={confirmar}
            rotuloConfirmar={acaoPendente === "aprovar" ? "Aceitar" : "Recusar"}
            confirmarDesabilitado={processando}
          />
        }
      >
        <p className="text-sm text-ink">
          {acaoPendente === "aprovar"
            ? `Confirma aceitar o ${textoDesconto} deste pedido?`
            : `Confirma recusar o ${textoDesconto} deste pedido?`}{" "}
          Essa decisão não pode ser desfeita.
        </p>
      </Modal>
    </div>
  );
}
