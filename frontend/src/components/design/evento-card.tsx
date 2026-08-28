import type { ReactNode } from "react";
import { Card } from "./card";
import { SecondaryButton } from "./button";

// Card de evento horizontal (ver skill design-system, referência
// "Constructive", seção "Latest Events") - ícone em chip colorido +
// título + descrição + timestamp + ação, usado em fileira horizontal com
// scroll (nunca quebra linha, mesmo critério de "sem responsivo por
// enquanto" do pedido original).
export function EventoCard({
  icone,
  corIcone,
  titulo,
  descricao,
  horario,
  acaoRotulo,
  acaoHref,
}: {
  icone: ReactNode;
  corIcone: "primary" | "laranja" | "vermelho";
  titulo: string;
  descricao: string;
  horario: string;
  acaoRotulo: string;
  acaoHref: string;
}) {
  const corFundo = {
    primary: "bg-primary-light text-primary",
    laranja: "bg-accent-orange-light text-accent-orange",
    vermelho: "bg-accent-red-light text-accent-red",
  }[corIcone];

  return (
    <Card className="flex w-72 shrink-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${corFundo}`}>
          {icone}
        </span>
        <h3 className="truncate text-sm font-semibold text-ink">{titulo}</h3>
      </div>
      <p className="line-clamp-2 text-xs text-muted">{descricao}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{horario}</span>
        <SecondaryButton href={acaoHref} className="px-3 py-1.5 text-xs">
          {acaoRotulo}
        </SecondaryButton>
      </div>
    </Card>
  );
}
