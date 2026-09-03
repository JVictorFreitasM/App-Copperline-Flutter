import type { ReactNode } from "react";
import type { TimelineEvento } from "@/lib/timeline";
import { formatarDataHora, formatarMoeda } from "@/lib/formatacao";
import { configSituacaoPedido } from "@/lib/pedidos";
import { configStatusNfe } from "@/lib/notas-fiscais";
import {
  IconeCheck,
  IconeClipboard,
  IconePino,
  IconeRecibo,
} from "./icons";

// Linha do tempo unificada (OS-WEB-42/OS-MOBILE-40) - substitui a antiga
// seção "Visitas recentes" isolada (evita duplicar o mesmo dado em duas
// seções da tela, critério de aceite da OS) - visita continua aparecendo
// aqui, só que intercalada cronologicamente com pedido/status/nota fiscal
// em vez de numa lista separada.
export function Timeline({ eventos }: { eventos: TimelineEvento[] }) {
  return (
    <div className="flex flex-col">
      {eventos.map((evento, indice) => (
        <div key={`${evento.tipo}-${indice}`} className="flex gap-3">
          <div className="flex flex-col items-center">
            <ItemIcone evento={evento} />
            {indice < eventos.length - 1 && (
              <div className="w-px flex-1 bg-black/10" style={{ minHeight: 16 }} />
            )}
          </div>
          <div className="flex-1 pb-5">
            <ItemConteudo evento={evento} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ItemIcone({ evento }: { evento: TimelineEvento }) {
  const cor =
    evento.tipo === "VISITA_CANCELADA"
      ? "bg-accent-red-light text-accent-red"
      : "bg-primary-light text-primary";
  const icone: ReactNode =
    evento.tipo === "PEDIDO" || evento.tipo === "PEDIDO_STATUS_ALTERADO" ? (
      <IconeClipboard />
    ) : evento.tipo === "NOTA_FISCAL" ? (
      <IconeRecibo />
    ) : evento.tipo === "VISITA_CANCELADA" ? (
      <IconeCheck />
    ) : (
      <IconePino />
    );

  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cor}`}>
      {icone}
    </span>
  );
}

function ItemConteudo({ evento }: { evento: TimelineEvento }) {
  switch (evento.tipo) {
    case "PEDIDO": {
      const situacao = configSituacaoPedido(evento.situacao);
      return (
        <ItemTexto
          titulo={`Pedido ${evento.numero ?? "—"}`}
          descricao={`${situacao.rotulo}${evento.valorTotal ? ` · ${formatarMoeda(evento.valorTotal)}` : ""}`}
          data={evento.data}
        />
      );
    }
    case "PEDIDO_STATUS_ALTERADO": {
      const anterior = evento.statusAnterior
        ? configSituacaoPedido(evento.statusAnterior).rotulo
        : "—";
      const novo = configSituacaoPedido(evento.statusNovo).rotulo;
      return (
        <ItemTexto
          titulo="Status do pedido alterado"
          descricao={`${anterior} → ${novo}`}
          data={evento.data}
        />
      );
    }
    case "VISITA_CHECKIN":
      return <ItemTexto titulo="Check-in de visita" descricao="Visita iniciada" data={evento.data} />;
    case "VISITA_CHECKOUT":
      return (
        <ItemTexto titulo="Checkout de visita" descricao="Visita concluída" data={evento.data} />
      );
    case "VISITA_CANCELADA":
      return (
        <ItemTexto
          titulo="Visita cancelada"
          descricao={evento.motivo ?? "Sem motivo registrado"}
          data={evento.data}
        />
      );
    case "NOTA_FISCAL": {
      const status = configStatusNfe(evento.status);
      return (
        <ItemTexto
          titulo={`Nota fiscal ${evento.numero ?? "—"}`}
          descricao={status.rotulo}
          data={evento.data}
        />
      );
    }
  }
}

function ItemTexto({
  titulo,
  descricao,
  data,
}: {
  titulo: string;
  descricao: string;
  data: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 pt-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink">{titulo}</span>
        <span className="shrink-0 text-xs text-muted">{formatarDataHora(data)}</span>
      </div>
      <span className="text-xs text-muted">{descricao}</span>
    </div>
  );
}
