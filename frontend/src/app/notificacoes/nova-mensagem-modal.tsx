"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/design/modal";
import { PrimaryButton } from "@/components/design/button";
import type {
  DestinatarioMensagemDto,
  DestinoMensagem,
  GrupoMensagemDto,
} from "@/lib/mensagens";
import { enviarMensagem } from "./mensagens-actions";

const CLASSE_CAMPO =
  "w-full rounded-2xl bg-background px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light";

const LIMITE_ASSUNTO = 120;
const LIMITE_MENSAGEM = 2000;

// Modal "Nova mensagem" (referência: Enviar-mensagem via notificação.jpg) -
// Para (Todos / vendedor / grupo), Assunto, Mensagem e Enviar. O envio vira
// notificação no app dos destinatários (push + inbox).
export function NovaMensagemModal({
  open,
  onClose,
  vendedores,
  grupos,
}: {
  open: boolean;
  onClose: () => void;
  vendedores: DestinatarioMensagemDto[];
  grupos: GrupoMensagemDto[];
}) {
  const [destino, setDestino] = useState<DestinoMensagem>("TODOS");
  const [vendedorId, setVendedorId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const destinoCompleto =
    destino === "TODOS" || (destino === "VENDEDOR" && vendedorId) || (destino === "GRUPO" && grupoId);
  const podeEnviar =
    Boolean(destinoCompleto) && assunto.trim().length > 0 && mensagem.trim().length > 0 && !pending;

  function fechar() {
    if (pending) return;
    setErro(null);
    setAviso(null);
    onClose();
  }

  function enviar() {
    setErro(null);
    setAviso(null);
    startTransition(async () => {
      const resultado = await enviarMensagem({
        destino,
        vendedorId: destino === "VENDEDOR" ? vendedorId : undefined,
        grupoId: destino === "GRUPO" ? grupoId : undefined,
        assunto: assunto.trim(),
        mensagem: mensagem.trim(),
      });
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      const { totalDestinatarios, semAppVinculado } = resultado.dados;
      setAssunto("");
      setMensagem("");
      setAviso(
        `Mensagem enviada para ${totalDestinatarios} ${totalDestinatarios === 1 ? "pessoa" : "pessoas"}.` +
          (semAppVinculado > 0
            ? ` ${semAppVinculado} ${semAppVinculado === 1 ? "vendedor ficou" : "vendedores ficaram"} de fora por não ter o app vinculado.`
            : ""),
      );
    });
  }

  return (
    <Modal
      open={open}
      onClose={fechar}
      title="Nova mensagem"
      largura="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-4">
          <div className="min-h-5 text-sm" role="status">
            {erro && <p className="text-accent-red">{erro}</p>}
            {aviso && <p className="text-accent-green">{aviso}</p>}
          </div>
          <PrimaryButton type="button" disabled={!podeEnviar} onClick={enviar}>
            {pending ? "Enviando..." : "Enviar mensagem"}
          </PrimaryButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Para
          <select
            value={destino}
            onChange={(evento) => setDestino(evento.target.value as DestinoMensagem)}
            className={CLASSE_CAMPO}
          >
            <option value="TODOS">Todos os vendedores</option>
            <option value="VENDEDOR">Um vendedor</option>
            <option value="GRUPO" disabled={grupos.length === 0}>
              Um grupo{grupos.length === 0 ? " (nenhum criado ainda)" : ""}
            </option>
          </select>
        </label>

        {destino === "VENDEDOR" && (
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            Vendedor
            <select
              value={vendedorId}
              onChange={(evento) => setVendedorId(evento.target.value)}
              className={CLASSE_CAMPO}
            >
              <option value="">Selecione...</option>
              {vendedores.map((vendedor) => (
                <option key={vendedor.id} value={vendedor.id} disabled={!vendedor.comApp}>
                  {vendedor.nome}
                  {!vendedor.comApp ? " (sem app vinculado)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        {destino === "GRUPO" && (
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            Grupo
            <select
              value={grupoId}
              onChange={(evento) => setGrupoId(evento.target.value)}
              className={CLASSE_CAMPO}
            >
              <option value="">Selecione...</option>
              {grupos.map((grupo) => (
                <option key={grupo.id} value={grupo.id}>
                  {grupo.nome} ({grupo.vendedorIds.length})
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Assunto
          <input
            type="text"
            value={assunto}
            maxLength={LIMITE_ASSUNTO}
            onChange={(evento) => setAssunto(evento.target.value)}
            className={CLASSE_CAMPO}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Mensagem
          <textarea
            value={mensagem}
            rows={8}
            maxLength={LIMITE_MENSAGEM}
            onChange={(evento) => setMensagem(evento.target.value)}
            className={`${CLASSE_CAMPO} resize-y`}
          />
          <span className="self-end text-[11px] font-normal">
            {mensagem.length}/{LIMITE_MENSAGEM}
          </span>
        </label>
      </div>
    </Modal>
  );
}
