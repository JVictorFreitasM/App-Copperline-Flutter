"use client";

import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatarMoeda } from "@/lib/formatacao";

// Duas series lado a lado por categoria (mesmo visual minimalista de
// GraficoBarras, sem grid de fundo) - usado pra comparativo mes a mes
// (ano atual vs ano anterior, Epico 2 da OS-dashboard-configuracoes-
// notificacoes-auditoria.md) e "Vendas x Faturado" (Epico 1.2). Cor de
// cada serie é FIXA (passada por prop, nunca recalculada por posição) -
// pedido explícito da OS: "cada ano deve ter uma cor fixa e distinta,
// sempre a mesma associação cor↔ano".
export interface ItemGraficoBarrasComparativo {
  rotulo: string;
  valorA: number;
  valorB: number;
}

export function GraficoBarrasComparativo({
  dados,
  rotuloSerieA,
  rotuloSerieB,
  corSerieA = "var(--color-primary)",
  corSerieB = "var(--color-accent-orange)",
  altura = 260,
  formato,
}: {
  dados: ItemGraficoBarrasComparativo[];
  rotuloSerieA: string;
  rotuloSerieB: string;
  corSerieA?: string;
  corSerieB?: string;
  altura?: number;
  formato?: "moeda";
}) {
  const formatarValor = formato === "moeda" ? (valor: number) => formatarMoeda(String(valor)) : undefined;

  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 8 }} barCategoryGap="30%">
          <XAxis
            dataKey="rotulo"
            tick={{ fill: "var(--color-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: "var(--color-background)" }}
            formatter={(valor) => {
              const numero = Number(valor);
              return formatarValor ? formatarValor(numero) : numero;
            }}
            contentStyle={{
              borderRadius: 12,
              border: "none",
              boxShadow: "0 1px 8px rgba(0,0,0,0.08)",
            }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, color: "var(--color-muted)" }}
          />
          <Bar dataKey="valorA" name={rotuloSerieA} fill={corSerieA} radius={[6, 6, 0, 0]} maxBarSize={28} />
          <Bar dataKey="valorB" name={rotuloSerieB} fill={corSerieB} radius={[6, 6, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
