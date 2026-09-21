import type { ReactNode } from "react";
import { Card } from "./card";

// Epico 1.1 (OS-dashboard-configuracoes-notificacoes-auditoria.md) - os 3
// cards de KPI do topo do painel (referência `dash.jpg`, raiz do projeto):
// título pequeno em cima, número grande no meio (cor de ênfase quando o
// card representa algo que precisa de atenção - vermelho no layout de
// referência), subtítulo opcional em verde embaixo. Diferente de
// `StatCard` (ícone + label + valor pequeno, uso genérico) - este é
// especificamente o layout "número grande" do topo do dashboard.
export function KpiHeaderCard({
  titulo,
  valor,
  corValor = "ink",
  subtitulo,
  className = "",
}: {
  titulo: string;
  valor: ReactNode;
  corValor?: "ink" | "vermelho";
  subtitulo?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`flex flex-col items-center gap-1 text-center ${className}`}>
      <p className="text-sm text-muted">{titulo}</p>
      <p
        className={`text-3xl font-bold ${corValor === "vermelho" ? "text-accent-red" : "text-ink"}`}
      >
        {valor}
      </p>
      {subtitulo && <p className="text-sm font-medium text-accent-green">{subtitulo}</p>}
    </Card>
  );
}
