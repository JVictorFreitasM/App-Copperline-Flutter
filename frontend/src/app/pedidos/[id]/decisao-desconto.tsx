"use client";

import { useState, useTransition } from "react";
import { Modal, ModalFooter } from "@/components/design/modal";
import { IconeCheck, IconeX } from "@/components/design/icons";
import type { PedidoItemDto, SolicitacaoDescontoDoPedidoDto } from "@/lib/pedidos";
import { decidirDescontoPedido } from "./actions";

type Acao = "aprovar" | "rejeitar";

// Pedido do usuário (2026-10-02): o supervisor aceita/recusa o desconto ITEM
// POR ITEM; o pedido só segue quando todos foram decididos - segue só com os
// aceitos, ou é cancelado se todos forem recusados. Fluxo de cada botão:
// clique -> popup de confirmação -> decisão -> botões inativos. O backend
// valida a alçada (podeDecidir só controla se os botões nascem ativos).
// Cores vermelho/verde são exceção deliberada à paleta neutra (ver skill
// design-system): aqui é aprovar/reprovar de verdade.

export function ItemDecisaoBotoes({
  pedidoId,
  item,
  podeDecidir,
}: {
  pedidoId: string;
  item: PedidoItemDto;
  podeDecidir: boolean;
}) {
  const [acaoPendente, setAcaoPendente] = useState<Acao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, iniciarTransicao] = useTransition();

  const decidido = item.statusAprovacao !== "PENDENTE";
  const inativo = decidido || !podeDecidir || processando;
  const aprovado = item.statusAprovacao === "APROVADO";
  const rejeitado = item.statusAprovacao === "REJEITADO";

  function confirmar() {
    if (!acaoPendente) return;
    const acao = acaoPendente;
    iniciarTransicao(async () => {
      const resultado = await decidirDescontoPedido(pedidoId, item.id, acao);
      setAcaoPendente(null);
      setErro(resultado.erro);
    });
  }

  return (
    <div className="flex items-center gap-1.5" title={erro ?? undefined}>
      <button
        type="button"
        disabled={inativo}
        onClick={() => setAcaoPendente("rejeitar")}
        aria-label="Recusar desconto do item"
        aria-pressed={rejeitado}
        className={`flex h-7 w-7 items-center justify-center rounded-full transition disabled:pointer-events-none disabled:opacity-40 ${
          rejeitado
            ? "bg-accent-red text-white"
            : "bg-accent-red-light text-accent-red hover:opacity-80"
        }`}
      >
        <IconeX />
      </button>
      <button
        type="button"
        disabled={inativo}
        onClick={() => setAcaoPendente("aprovar")}
        aria-label="Aceitar desconto do item"
        aria-pressed={aprovado}
        className={`flex h-7 w-7 items-center justify-center rounded-full transition disabled:pointer-events-none disabled:opacity-40 ${
          aprovado
            ? "bg-accent-green text-white"
            : "bg-accent-green-light text-accent-green hover:opacity-80"
        }`}
      >
        <IconeCheck />
      </button>

      <Modal
        open={acaoPendente !== null}
        onClose={() => !processando && setAcaoPendente(null)}
        title={acaoPendente === "aprovar" ? "Aceitar desconto do item" : "Recusar desconto do item"}
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
            ? `Confirma aceitar o desconto de "${item.produto?.nome ?? "este item"}"?`
            : `Confirma recusar o desconto de "${item.produto?.nome ?? "este item"}"? O item sai do pedido.`}{" "}
          Essa decisão não pode ser desfeita.
        </p>
      </Modal>
    </div>
  );
}

// "Aceitar/recusar todos" - decide de uma vez os itens que ainda estão
// pendentes. Só aparece quando há solicitação de desconto no pedido.
export function DecisaoDescontoTodos({
  pedidoId,
  solicitacao,
  pendentes,
}: {
  pedidoId: string;
  solicitacao: SolicitacaoDescontoDoPedidoDto;
  pendentes: number;
}) {
  const [acaoPendente, setAcaoPendente] = useState<Acao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, iniciarTransicao] = useTransition();

  const decidido = solicitacao.status !== "PENDENTE";
  const inativo = decidido || pendentes === 0 || !solicitacao.podeDecidir || processando;

  function confirmar() {
    if (!acaoPendente) return;
    const acao = acaoPendente;
    iniciarTransicao(async () => {
      const resultado = await decidirDescontoPedido(pedidoId, null, acao);
      setAcaoPendente(null);
      setErro(resultado.erro);
    });
  }

  const rotulo =
    solicitacao.status === "APROVADO"
      ? "Desconto decidido - pedido enviado"
      : solicitacao.status === "REJEITADO"
        ? "Todos os itens recusados - pedido cancelado"
        : "Aguardando decisão";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">
          {rotulo} ({solicitacao.percentualSolicitado}% de desconto
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
          Recusar todos
        </button>
        <button
          type="button"
          disabled={inativo}
          onClick={() => setAcaoPendente("aprovar")}
          className="inline-flex items-center justify-center rounded-full bg-accent-green px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
        >
          Aceitar todos
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
        title={acaoPendente === "aprovar" ? "Aceitar todos os descontos" : "Recusar todos os descontos"}
        footer={
          <ModalFooter
            onCancelar={() => setAcaoPendente(null)}
            onConfirmar={confirmar}
            rotuloConfirmar={acaoPendente === "aprovar" ? "Aceitar todos" : "Recusar todos"}
            confirmarDesabilitado={processando}
          />
        }
      >
        <p className="text-sm text-ink">
          {acaoPendente === "aprovar"
            ? `Confirma aceitar o desconto dos ${pendentes} item(ns) pendentes? O pedido será enviado.`
            : `Confirma recusar o desconto dos ${pendentes} item(ns) pendentes? Os itens saem do pedido.`}{" "}
          Essa decisão não pode ser desfeita.
        </p>
      </Modal>
    </div>
  );
}
