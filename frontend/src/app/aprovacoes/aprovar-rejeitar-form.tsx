"use client";

import { useActionState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/design/button";
import { aprovarSolicitacao, rejeitarSolicitacao } from "./actions";
import type { EstadoDecisao } from "./actions";

const ESTADO_INICIAL: EstadoDecisao = { erro: null, sucesso: null };

// Client component isolado (OS-WEB-28) - so pra poder usar useActionState:
// aprovar/rejeitar mostram feedback (sucesso/erro) e desabilitam os botoes
// durante o pending SEM navegar pra lugar nenhum (a lista em si e' Server
// Component, atualizada via revalidatePath dentro da action, ver
// actions.ts) - antes disso, cada decisao fazia um redirect() so pra
// carregar `?sucesso=`/`?erro=` na URL, o que resetava o scroll da pagina
// a cada aprovacao/rejeicao (mesmo sendo navegacao client-side, sem reload
// de documento).
export function AprovarRejeitarForm({ solicitacaoId }: { solicitacaoId: string }) {
  const [estadoAprovar, acaoAprovar, pendingAprovar] = useActionState(
    aprovarSolicitacao.bind(null, solicitacaoId),
    ESTADO_INICIAL,
  );
  const [estadoRejeitar, acaoRejeitar, pendingRejeitar] = useActionState(
    rejeitarSolicitacao.bind(null, solicitacaoId),
    ESTADO_INICIAL,
  );

  const pending = pendingAprovar || pendingRejeitar;
  const estado = estadoAprovar.erro || estadoAprovar.sucesso ? estadoAprovar : estadoRejeitar;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <form action={acaoAprovar}>
          <PrimaryButton type="submit" disabled={pending}>
            Aprovar
          </PrimaryButton>
        </form>
        <form action={acaoRejeitar}>
          <SecondaryButton type="submit" disabled={pending}>
            Rejeitar
          </SecondaryButton>
        </form>
      </div>
      {estado.sucesso && <p className="text-xs font-medium text-ink">{estado.sucesso}</p>}
      {estado.erro && <p className="text-xs font-medium text-muted">{estado.erro}</p>}
    </div>
  );
}
