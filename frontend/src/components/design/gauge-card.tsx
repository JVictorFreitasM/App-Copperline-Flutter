"use client";

import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";
import { Card } from "./card";

// Card de "medidor" (ver skill design-system, referência "Constructive",
// card "Site Speed") - adaptado aqui pra saúde de estoque: percentual de
// produtos SEM criticidade (100 - % crítico), não latência de rede (sem
// analogia real no nosso domínio pra "velocidade" - adaptação honesta do
// padrão visual, não invenção de dado). Client Component só por causa do
// Recharts.
export function GaugeCard({
  percentual,
  legendaVerde,
  legendaVermelha,
}: {
  percentual: number;
  legendaVerde: { rotulo: string; valor: string };
  legendaVermelha: { rotulo: string; valor: string };
}) {
  const dados = [{ nome: "saude", valor: percentual, fill: "var(--color-primary)" }];

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Saúde do estoque</h3>
        <span className="text-xs font-medium text-accent-orange">Hoje</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative h-28 w-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              data={dados}
              innerRadius="72%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              barSize={12}
            >
              <RadialBar dataKey="valor" background={{ fill: "var(--color-background)" }} cornerRadius={999} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-ink">{percentual.toFixed(0)}%</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-accent-green" />
            <span className="text-muted">{legendaVerde.rotulo}</span>
            <span className="font-semibold text-ink">{legendaVerde.valor}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-accent-red" />
            <span className="text-muted">{legendaVermelha.rotulo}</span>
            <span className="font-semibold text-ink">{legendaVermelha.valor}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
