"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  buscarContagemNaoLidas,
  buscarNotificacoesRecentes,
  marcarNotificacaoComoLida,
} from "@/app/notificacoes/actions";
import { formatarDataHora } from "@/lib/formatacao";
import { destinoDaNotificacao, type NotificacaoDto } from "@/lib/notificacoes";
import { IconeSino } from "./icons";
import { Modal } from "./modal";

const INTERVALO_POLL_MS = 60_000;

// Epico 5 - sino da Topbar deixa de ser so visual (comentario antigo:
// "sem sistema de notificacao in-app no web ainda"). Poll simples (sem
// WebSocket/SSE, fora de escopo) - contagem atualizada a cada 1min, mesmo
// criterio de "nao vale a pena mais infra pro volume desse app interno".
// Modal reaproveitado (mesmo componente do resto do projeto) em vez de um
// dropdown ancorado novo - evita reinventar posicionamento/z-index.
export function NotificacaoSino() {
  const [contagem, setContagem] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [notificacoes, setNotificacoes] = useState<NotificacaoDto[] | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    async function atualizarContagem() {
      try {
        const valor = await buscarContagemNaoLidas();
        if (!cancelado) setContagem(valor);
      } catch {
        // Silencioso - badge so nao atualiza nesse ciclo, tenta de novo no
        // proximo poll (mesmo criterio de secoes secundarias no resto do
        // projeto, nao vale travar a topbar inteira por isso).
      }
    }
    atualizarContagem();
    const intervalo = setInterval(atualizarContagem, INTERVALO_POLL_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, []);

  function abrir() {
    setAberto(true);
    setCarregando(true);
    buscarNotificacoesRecentes()
      .then(setNotificacoes)
      .finally(() => setCarregando(false));
  }

  function marcarComoLida(id: string) {
    setNotificacoes((atual) => atual?.map((n) => (n.id === id ? { ...n, lida: true } : n)) ?? null);
    setContagem((atual) => Math.max(0, atual - 1));
    marcarNotificacaoComoLida(id).catch(() => {
      // Falha no marcar - a lista ainda vai refletir o estado real na
      // proxima abertura (buscarNotificacoesRecentes re-busca do backend).
    });
  }

  return (
    <>
      <button
        type="button"
        title="Notificações"
        onClick={abrir}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-background text-muted transition hover:text-ink"
      >
        <IconeSino />
        {contagem > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-solid px-1 text-[10px] font-semibold text-on-solid">
            {contagem > 99 ? "99+" : contagem}
          </span>
        )}
      </button>

      <Modal open={aberto} onClose={() => setAberto(false)} title="Notificações" largura="max-w-md">
        {carregando ? (
          <p className="text-sm text-muted">Carregando...</p>
        ) : !notificacoes || notificacoes.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma notificação por aqui.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {notificacoes.map((notificacao) => {
              const destino = destinoDaNotificacao(notificacao.dados);
              const conteudo = (
                <div>
                  <div className="flex items-center gap-2">
                    {!notificacao.lida && (
                      <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                    )}
                    <p className="text-sm font-medium text-ink">{notificacao.titulo}</p>
                  </div>
                  <p className="text-sm text-muted">{notificacao.corpo}</p>
                  <p className="text-xs text-muted">{formatarDataHora(notificacao.criadoEm)}</p>
                  {destino && (
                    <p className="text-xs font-medium text-primary">{destino.rotulo} →</p>
                  )}
                </div>
              );
              return (
              <div key={notificacao.id} className="flex items-start justify-between gap-3">
                {destino ? (
                  // Abrir já marca como lida e fecha o modal - a navegação
                  // leva direto ao pedido (ou às Aprovações, pro supervisor).
                  <Link
                    href={destino.href}
                    onClick={() => {
                      if (!notificacao.lida) marcarComoLida(notificacao.id);
                      setAberto(false);
                    }}
                    className="block flex-1"
                  >
                    {conteudo}
                  </Link>
                ) : (
                  conteudo
                )}
                {!notificacao.lida && (
                  <button
                    type="button"
                    onClick={() => marcarComoLida(notificacao.id)}
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    Marcar como lida
                  </button>
                )}
              </div>
              );
            })}
          </div>
        )}
        <Link
          href="/notificacoes"
          onClick={() => setAberto(false)}
          className="mt-4 block text-center text-sm font-medium text-primary hover:underline"
        >
          Ver todas
        </Link>
      </Modal>
    </>
  );
}
