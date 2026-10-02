"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Card } from "@/components/design/card";
import { Badge } from "@/components/badge";
import { formatarDataHora } from "@/lib/formatacao";
import { destinoDaNotificacao, type NotificacaoDto } from "@/lib/notificacoes";
import { marcarNotificacaoComoLida } from "./actions";

export function NotificacaoItem({ notificacao }: { notificacao: NotificacaoDto }) {
  const [lida, setLida] = useState(notificacao.lida);
  const [pending, startTransition] = useTransition();
  const destino = destinoDaNotificacao(notificacao.dados);

  function marcarComoLida() {
    if (lida) return;
    setLida(true);
    startTransition(async () => {
      try {
        await marcarNotificacaoComoLida(notificacao.id);
      } catch {
        setLida(false);
      }
    });
  }

  const conteudo = (
    <div>
      <div className="flex items-center gap-2">
        {!lida && <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />}
        <p className="text-sm font-medium text-ink">{notificacao.titulo}</p>
      </div>
      <p className="mt-1 text-sm text-muted">{notificacao.corpo}</p>
      <p className="mt-1 text-xs text-muted">{formatarDataHora(notificacao.criadoEm)}</p>
      {destino && (
        <p className="mt-1 text-xs font-medium text-primary">{destino.rotulo} →</p>
      )}
    </div>
  );

  return (
    <Card className={lida ? "opacity-70" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        {destino ? (
          // Abrir a notificação já a marca como lida (a navegação não depende
          // do retorno da action).
          <Link href={destino.href} onClick={marcarComoLida} className="block flex-1">
            {conteudo}
          </Link>
        ) : (
          conteudo
        )}
        {lida ? (
          <Badge>Lida</Badge>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={marcarComoLida}
            className="text-xs font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-40"
          >
            Marcar como lida
          </button>
        )}
      </div>
    </Card>
  );
}
