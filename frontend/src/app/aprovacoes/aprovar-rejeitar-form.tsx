"use client";

import { useActionState, useRef, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/design/button";
import { Modal, ModalFooter } from "@/components/design/modal";
import { aprovarSolicitacao, rejeitarSolicitacao } from "./actions";
import type { EstadoDecisao } from "./actions";

const ESTADO_INICIAL: EstadoDecisao = { erro: null, sucesso: null };

type Acao = "aprovar" | "rejeitar";

// Client component isolado (OS-WEB-28) - so pra poder usar useActionState:
// aprovar/rejeitar mostram feedback (sucesso/erro) e desabilitam os botoes
// durante o pending SEM navegar pra lugar nenhum (a lista em si e' Server
// Component, atualizada via revalidatePath dentro da action, ver
// actions.ts) - antes disso, cada decisao fazia um redirect() so pra
// carregar `?sucesso=`/`?erro=` na URL, o que resetava o scroll da pagina
// a cada aprovacao/rejeicao (mesmo sendo navegacao client-side, sem reload
// de documento).
//
// Pedido do usuario (2026-10-02): clicar abre um popup de confirmacao antes
// de decidir (decisao nao se desfaz), e os botoes ficam inativos depois. A
// solicitacao inteira = todos os itens do pedido que ainda estao pendentes.
export function AprovarRejeitarForm({ solicitacaoId }: { solicitacaoId: string }) {
  const [estadoAprovar, acaoAprovar, pendingAprovar] = useActionState(
    aprovarSolicitacao.bind(null, solicitacaoId),
    ESTADO_INICIAL,
  );
  const [estadoRejeitar, acaoRejeitar, pendingRejeitar] = useActionState(
    rejeitarSolicitacao.bind(null, solicitacaoId),
    ESTADO_INICIAL,
  );
  const [acaoPendente, setAcaoPendente] = useState<Acao | null>(null);
  const formAprovarRef = useRef<HTMLFormElement>(null);
  const formRejeitarRef = useRef<HTMLFormElement>(null);

  const pending = pendingAprovar || pendingRejeitar;
  const estado = estadoAprovar.erro || estadoAprovar.sucesso ? estadoAprovar : estadoRejeitar;
  // Depois de decidida com sucesso os botoes ficam inativos (a linha some da
  // lista no proximo render do servidor, mas ate la nao pode decidir de novo).
  const decidida = Boolean(estadoAprovar.sucesso || estadoRejeitar.sucesso);
  const inativo = pending || decidida;

  function confirmar() {
    const acao = acaoPendente;
    setAcaoPendente(null);
    // requestSubmit dispara a Server Action do form certo (useActionState).
    if (acao === "aprovar") formAprovarRef.current?.requestSubmit();
    if (acao === "rejeitar") formRejeitarRef.current?.requestSubmit();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <form ref={formRejeitarRef} action={acaoRejeitar}>
          <SecondaryButton type="button" disabled={inativo} onClick={() => setAcaoPendente("rejeitar")}>
            Rejeitar
          </SecondaryButton>
        </form>
        <form ref={formAprovarRef} action={acaoAprovar}>
          <PrimaryButton type="button" disabled={inativo} onClick={() => setAcaoPendente("aprovar")}>
            Aprovar
          </PrimaryButton>
        </form>
      </div>
      {estado.sucesso && <p className="text-xs font-medium text-ink">{estado.sucesso}</p>}
      {estado.erro && <p className="text-xs font-medium text-muted">{estado.erro}</p>}

      <Modal
        open={acaoPendente !== null}
        onClose={() => setAcaoPendente(null)}
        title={acaoPendente === "aprovar" ? "Aprovar desconto" : "Rejeitar desconto"}
        footer={
          <ModalFooter
            onCancelar={() => setAcaoPendente(null)}
            onConfirmar={confirmar}
            rotuloConfirmar={acaoPendente === "aprovar" ? "Aprovar" : "Rejeitar"}
          />
        }
      >
        <p className="text-sm text-ink">
          {acaoPendente === "aprovar"
            ? "Confirma aprovar o desconto de todos os itens pendentes deste pedido? O pedido será enviado."
            : "Confirma rejeitar o desconto de todos os itens pendentes deste pedido? Os itens saem do pedido, e se nenhum for aceito o pedido é cancelado."}{" "}
          Essa decisão não pode ser desfeita.
        </p>
      </Modal>
    </div>
  );
}
