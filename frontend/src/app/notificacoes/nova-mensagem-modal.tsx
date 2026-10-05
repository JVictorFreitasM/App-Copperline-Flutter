"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/design/modal";
import { PrimaryButton } from "@/components/design/button";
import {
  DIAS_DA_SEMANA,
  type DestinatarioMensagemDto,
  type DestinoMensagem,
  type FrequenciaMensagem,
  type GrupoMensagemDto,
  type MensagemPeriodicaDto,
} from "@/lib/mensagens";
import { atualizarPeriodica, criarPeriodica, enviarMensagem } from "./mensagens-actions";

const CLASSE_CAMPO =
  "w-full rounded-2xl bg-background px-4 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light";

const LIMITE_ASSUNTO = 120;
const LIMITE_MENSAGEM = 2000;

type Quando = "AGORA" | "PERIODICA";

// Modal "Nova mensagem" (referência: Enviar-mensagem via notificação.jpg) -
// Para (Todos / vendedor / grupo), Assunto, Mensagem e Enviar. O envio vira
// notificação no app dos destinatários (push + inbox). "Quando": agora
// (envio avulso) ou periodicamente (cadastra uma mensagem periódica, o
// horário é sempre o de Brasília). Com `edicao` edita uma periódica
// existente. Renderizado só enquanto aberto (ver mensagens-admin.tsx), então
// o estado sempre começa limpo - sem efeito de "reset ao abrir".
export function NovaMensagemModal({
  onClose,
  onPeriodicaSalva,
  vendedores,
  grupos,
  modoInicial = "AGORA",
  edicao = null,
}: {
  onClose: () => void;
  onPeriodicaSalva: () => void;
  vendedores: DestinatarioMensagemDto[];
  grupos: GrupoMensagemDto[];
  modoInicial?: Quando;
  edicao?: MensagemPeriodicaDto | null;
}) {
  const [quando, setQuando] = useState<Quando>(edicao ? "PERIODICA" : modoInicial);
  const [destino, setDestino] = useState<DestinoMensagem>(edicao?.destino ?? "TODOS");
  const [vendedorId, setVendedorId] = useState(edicao?.vendedorId ?? "");
  const [grupoId, setGrupoId] = useState(edicao?.grupoId ?? "");
  const [assunto, setAssunto] = useState(edicao?.assunto ?? "");
  const [mensagem, setMensagem] = useState(edicao?.corpo ?? "");
  const [frequencia, setFrequencia] = useState<FrequenciaMensagem>(edicao?.frequencia ?? "DIAS_UTEIS");
  const [horario, setHorario] = useState(edicao?.horario ?? "08:00");
  const [diaSemana, setDiaSemana] = useState(edicao?.diaSemana ?? 1);
  const [diaMes, setDiaMes] = useState(edicao?.diaMes ?? 1);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const periodica = quando === "PERIODICA";
  const destinoCompleto =
    destino === "TODOS" || (destino === "VENDEDOR" && vendedorId) || (destino === "GRUPO" && grupoId);
  const recorrenciaCompleta = !periodica || /^([01]\d|2[0-3]):[0-5]\d$/.test(horario);
  const podeEnviar =
    Boolean(destinoCompleto) &&
    recorrenciaCompleta &&
    assunto.trim().length > 0 &&
    mensagem.trim().length > 0 &&
    !pending;

  function fechar() {
    if (pending) return;
    onClose();
  }

  function enviar() {
    setErro(null);
    setAviso(null);
    const base = {
      destino,
      vendedorId: destino === "VENDEDOR" ? vendedorId : undefined,
      grupoId: destino === "GRUPO" ? grupoId : undefined,
      assunto: assunto.trim(),
      mensagem: mensagem.trim(),
    };

    startTransition(async () => {
      if (periodica) {
        const input = {
          ...base,
          frequencia,
          horario,
          diaSemana: frequencia === "SEMANAL" ? diaSemana : undefined,
          diaMes: frequencia === "MENSAL" ? diaMes : undefined,
        };
        const resultado = edicao
          ? await atualizarPeriodica(edicao.id, input)
          : await criarPeriodica(input);
        if (!resultado.ok) {
          setErro(resultado.erro);
          return;
        }
        onPeriodicaSalva();
        return;
      }

      const resultado = await enviarMensagem(base);
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

  const rotuloBotao = pending
    ? periodica
      ? "Salvando..."
      : "Enviando..."
    : periodica
      ? edicao
        ? "Salvar alterações"
        : "Agendar mensagem"
      : "Enviar mensagem";

  return (
    <Modal
      open
      onClose={fechar}
      title={edicao ? "Editar mensagem periódica" : "Nova mensagem"}
      largura="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-4">
          <div className="min-h-5 text-sm" role="status">
            {erro && <p className="text-accent-red">{erro}</p>}
            {aviso && <p className="text-accent-green">{aviso}</p>}
          </div>
          <PrimaryButton type="button" disabled={!podeEnviar} onClick={enviar}>
            {rotuloBotao}
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
            rows={7}
            maxLength={LIMITE_MENSAGEM}
            onChange={(evento) => setMensagem(evento.target.value)}
            className={`${CLASSE_CAMPO} resize-y`}
          />
          <span className="self-end text-[11px] font-normal">
            {mensagem.length}/{LIMITE_MENSAGEM}
          </span>
        </label>

        <div className="flex flex-col gap-3">
          {!edicao && (
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
              Quando enviar
              <select
                value={quando}
                onChange={(evento) => setQuando(evento.target.value as Quando)}
                className={CLASSE_CAMPO}
              >
                <option value="AGORA">Agora</option>
                <option value="PERIODICA">Periodicamente</option>
              </select>
            </label>
          )}

          {periodica && (
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                Repetir
                <select
                  value={frequencia}
                  onChange={(evento) => setFrequencia(evento.target.value as FrequenciaMensagem)}
                  className={CLASSE_CAMPO}
                >
                  <option value="DIARIA">Todos os dias</option>
                  <option value="DIAS_UTEIS">Dias úteis (seg a sex)</option>
                  <option value="SEMANAL">Toda semana</option>
                  <option value="MENSAL">Todo mês</option>
                </select>
              </label>

              {frequencia === "SEMANAL" && (
                <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                  Dia da semana
                  <select
                    value={diaSemana}
                    onChange={(evento) => setDiaSemana(Number(evento.target.value))}
                    className={CLASSE_CAMPO}
                  >
                    {DIAS_DA_SEMANA.map((dia, indice) => (
                      <option key={dia} value={indice}>
                        {dia}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {frequencia === "MENSAL" && (
                <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                  Dia do mês
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={diaMes}
                    onChange={(evento) => setDiaMes(Number(evento.target.value))}
                    className={CLASSE_CAMPO}
                  />
                </label>
              )}

              <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                Horário (Brasília)
                <input
                  type="time"
                  value={horario}
                  onChange={(evento) => setHorario(evento.target.value)}
                  className={CLASSE_CAMPO}
                />
              </label>
            </div>
          )}

          {periodica && frequencia === "MENSAL" && diaMes > 28 && (
            <p className="text-xs text-muted">
              Em meses com menos de {diaMes} dias, a mensagem sai no último dia do mês.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
