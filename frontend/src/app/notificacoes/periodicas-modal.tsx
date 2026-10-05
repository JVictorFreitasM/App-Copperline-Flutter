"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/design/modal";
import { PrimaryButton, SecondaryButton } from "@/components/design/button";
import { Switch } from "@/components/design/switch";
import { formatarDataHora } from "@/lib/formatacao";
import { descreverRecorrencia, type MensagemPeriodicaDto } from "@/lib/mensagens";
import { alternarPeriodica, removerPeriodica } from "./mensagens-actions";

// Lista das mensagens periódicas (agendadas): liga/desliga, edita e remove.
// Cadastro e edição reaproveitam o modal de "Nova mensagem" (aberto por
// quem renderiza este, ver mensagens-admin.tsx).
export function PeriodicasModal({
  periodicas,
  onClose,
  onNova,
  onEditar,
}: {
  periodicas: MensagemPeriodicaDto[];
  onClose: () => void;
  onNova: () => void;
  onEditar: (periodica: MensagemPeriodicaDto) => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function alternar(periodica: MensagemPeriodicaDto, ativa: boolean) {
    setErro(null);
    startTransition(async () => {
      const resultado = await alternarPeriodica(periodica.id, ativa);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      router.refresh();
    });
  }

  function remover(periodica: MensagemPeriodicaDto) {
    if (
      !window.confirm(
        `Remover a mensagem periódica "${periodica.assunto}"? As mensagens já enviadas continuam no histórico.`,
      )
    ) {
      return;
    }
    setErro(null);
    startTransition(async () => {
      const resultado = await removerPeriodica(periodica.id);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Mensagens periódicas"
      largura="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-4">
          <p className="min-h-5 text-sm text-accent-red" role="status">
            {erro}
          </p>
          <PrimaryButton type="button" onClick={onNova}>
            Nova periódica
          </PrimaryButton>
        </div>
      }
    >
      {periodicas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          Nenhuma mensagem periódica ainda. Crie uma para enviar um aviso que se repete sozinho (por
          exemplo, toda segunda às 8h).
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {periodicas.map((periodica) => (
            <li key={periodica.id} className="flex flex-col gap-3 rounded-2xl bg-background p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{periodica.assunto}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Para {periodica.destinoRotulo} · {descreverRecorrencia(periodica)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {periodica.ativa
                      ? `Próximo envio: ${formatarDataHora(periodica.proximoEnvioEm)}`
                      : "Pausada"}
                    {periodica.ultimoEnvioEm &&
                      ` · Último envio: ${formatarDataHora(periodica.ultimoEnvioEm)}`}
                  </p>
                  {periodica.ultimoErro && (
                    <p className="mt-1 text-xs text-accent-red">
                      O último disparo não enviou: {periodica.ultimoErro}
                    </p>
                  )}
                </div>
                <Switch
                  checked={periodica.ativa}
                  disabled={pending}
                  label={periodica.ativa ? "Pausar" : "Ativar"}
                  onChange={(ativa) => alternar(periodica, ativa)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <SecondaryButton type="button" disabled={pending} onClick={() => onEditar(periodica)}>
                  Editar
                </SecondaryButton>
                <SecondaryButton type="button" disabled={pending} onClick={() => remover(periodica)}>
                  Remover
                </SecondaryButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
