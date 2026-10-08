"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/badge";
import { PrimaryButton, SecondaryButton } from "@/components/design/button";
import { Card } from "@/components/design/card";
import { Modal } from "@/components/design/modal";
import type { ContaAcessoDto, SessaoAtivaDto } from "@/lib/acessos";
import { bloquearConta, desbloquearConta, encerrarSessao } from "./actions";

type Filtro = "todas" | "conectadas" | "bloqueadas";

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "conectadas", rotulo: "Conectadas agora" },
  { id: "bloqueadas", rotulo: "Bloqueadas" },
];

function formatarData(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime()) || data.getTime() === 0) return "—";
  return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function ListaContas({ contas, meuEmail }: { contas: ContaAcessoDto[]; meuEmail: string }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [alvo, setAlvo] = useState<ContaAcessoDto | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return contas.filter((conta) => {
      if (filtro === "conectadas" && conta.sessoes.length === 0) return false;
      if (filtro === "bloqueadas" && !conta.bloqueado) return false;
      return !termo || conta.nome.toLowerCase().includes(termo) || conta.email.toLowerCase().includes(termo);
    });
  }, [contas, busca, filtro]);

  function executar(acao: () => Promise<void>, aoConcluir?: () => void) {
    setErro(null);
    startTransition(async () => {
      try {
        await acao();
        aoConcluir?.();
      } catch {
        setErro("Não foi possível concluir a ação. Tente novamente.");
      }
    });
  }

  function confirmarBloqueio() {
    if (!alvo) return;
    executar(
      () => bloquearConta(alvo.id, motivo),
      () => {
        setAlvo(null);
        setMotivo("");
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar por nome ou e-mail"
          className="w-72 rounded-full bg-surface px-4 py-2 text-sm text-ink shadow-sm outline-none"
        />
        <div className="flex gap-2">
          {FILTROS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFiltro(item.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                filtro === item.id ? "bg-solid text-on-solid" : "bg-surface text-muted shadow-sm"
              }`}
            >
              {item.rotulo}
            </button>
          ))}
        </div>
      </div>

      {erro && <p className="text-sm font-medium text-ink">{erro}</p>}

      {visiveis.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma conta encontrada.</p>
      ) : (
        visiveis.map((conta) => (
          <Card key={conta.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{conta.nome}</p>
                  {conta.bloqueado && <Badge enfase>Bloqueada</Badge>}
                  {conta.sessoes.length > 0 && <Badge>{conta.sessoes.length} conectado(s)</Badge>}
                </div>
                <p className="text-xs text-muted">{conta.email}</p>
                {conta.bloqueado && (
                  <p className="mt-1 text-xs text-muted">
                    Bloqueada em {conta.bloqueadoEm ? formatarData(conta.bloqueadoEm) : "—"}
                    {conta.motivoBloqueio ? ` — ${conta.motivoBloqueio}` : ""}
                  </p>
                )}
              </div>
              {conta.bloqueado ? (
                <SecondaryButton disabled={pending} onClick={() => executar(() => desbloquearConta(conta.id))}>
                  Desbloquear
                </SecondaryButton>
              ) : conta.email === meuEmail ? null : (
                <SecondaryButton disabled={pending} onClick={() => setAlvo(conta)}>
                  Bloquear conta
                </SecondaryButton>
              )}
            </div>

            {conta.sessoes.length > 0 && (
              <ul className="mt-4 flex flex-col divide-y divide-black/5">
                {conta.sessoes.map((sessao) => (
                  <LinhaSessao
                    key={sessao.id}
                    sessao={sessao}
                    desabilitado={pending}
                    onEncerrar={() => executar(() => encerrarSessao(sessao.id))}
                  />
                ))}
              </ul>
            )}
          </Card>
        ))
      )}

      <Modal
        open={alvo !== null}
        onClose={() => setAlvo(null)}
        title={`Bloquear ${alvo?.nome ?? ""}?`}
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setAlvo(null)}>Cancelar</SecondaryButton>
            <PrimaryButton disabled={pending} onClick={confirmarBloqueio}>
              {pending ? "Bloqueando..." : "Bloquear"}
            </PrimaryButton>
          </div>
        }
      >
        <p className="text-sm text-ink">
          Todas as sessões (celulares e navegadores) desta conta serão encerradas agora e ela não conseguirá mais
          usar o App Copperline até ser desbloqueada.
        </p>
        <label className="mt-4 flex flex-col gap-1 text-xs text-muted">
          Motivo (opcional)
          <input
            value={motivo}
            maxLength={300}
            onChange={(evento) => setMotivo(evento.target.value)}
            className="rounded-lg bg-background px-3 py-2 text-sm text-ink outline-none"
          />
        </label>
      </Modal>
    </div>
  );
}

function LinhaSessao({
  sessao,
  desabilitado,
  onEncerrar,
}: {
  sessao: SessaoAtivaDto;
  desabilitado: boolean;
  onEncerrar: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm text-ink">
          {sessao.plataforma === "mobile" ? "Celular" : sessao.plataforma === "web" ? "Navegador" : "Sessão"} —{" "}
          {sessao.dispositivo}
        </p>
        <p className="text-xs text-muted">
          {sessao.ip ? `IP ${sessao.ip} · ` : ""}Último acesso {formatarData(sessao.ultimoAcessoEm)}
        </p>
      </div>
      <SecondaryButton disabled={desabilitado} onClick={onEncerrar}>
        Encerrar sessão
      </SecondaryButton>
    </li>
  );
}
