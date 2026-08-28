"use client";

import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Card } from "./card";

const CORES = {
  primary: { cheio: "var(--color-primary)", trilho: "var(--color-primary-light)" },
  laranja: { cheio: "var(--color-accent-orange)", trilho: "var(--color-accent-orange-light)" },
  vermelho: { cheio: "var(--color-accent-red)", trilho: "var(--color-accent-red-light)" },
} as const;

// Card de KPI com anel de progresso (ver skill design-system, referência
// "Constructive") - percentual + número grande + link de detalhe, cada
// card com uma cor de acento diferente (só aqui - nunca em UI genérica,
// ver globals.css). Client Component só por causa do Recharts, mesmo
// critério de GraficoBarras.
export function DonutKpiCard({
  titulo,
  percentual,
  valor,
  cor,
  href,
}: {
  titulo: string;
  percentual: number;
  valor: string;
  cor: keyof typeof CORES;
  href: string;
}) {
  const paleta = CORES[cor];
  const dados = [
    { nome: "preenchido", valor: percentual },
    { nome: "restante", valor: Math.max(0, 100 - percentual) },
  ];

  return (
    <Card className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{titulo}</h3>
        <span className="text-xs text-muted">•••</span>
      </div>
      <p className="text-sm font-semibold" style={{ color: paleta.cheio }}>
        {percentual.toFixed(0)}%
      </p>
      <div className="mx-auto h-28 w-28">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dados}
              dataKey="valor"
              innerRadius="72%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              <Cell fill={paleta.cheio} />
              <Cell fill={paleta.trilho} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-xl font-bold text-ink">{valor}</p>
      <Link
        href={href}
        className="text-center text-sm font-medium text-primary hover:underline"
      >
        Ver mais
      </Link>
    </Card>
  );
}
