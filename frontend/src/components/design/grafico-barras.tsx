"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { formatarMoeda } from "@/lib/formatacao";

// Gráfico de barras minimalista (OS-WEB-19) - sem grid de fundo, duas
// tonalidades (ver skill design-system, "Gráfico de barras"): a barra de
// maior valor em `primary`, as demais em `primary-light` - "usar pra
// comparação simples, não pra dashboards densos" é exatamente o caso aqui
// (poucas categorias por gráfico: situação de pedido, status de nota
// fiscal, top 10 cliente/produto). Client Component só por causa do
// Recharts (SVG interativo/ResizeObserver) - os dados chegam já prontos
// via prop, buscados no Server Component (ver painel/page.tsx).
export interface ItemGraficoBarras {
  rotulo: string;
  valor: number;
}

export function GraficoBarras({
  dados,
  altura = 220,
  formato,
}: {
  dados: ItemGraficoBarras[];
  altura?: number;
  // "moeda" em vez de aceitar uma função formatadora via prop - Server
  // Component nao pode passar função pra Client Component (RSC nao
  // serializa função através do boundary), entao a formatação fica aqui
  // dentro, escolhida por um valor serializável (string).
  formato?: "moeda";
}) {
  const valorMaximo = Math.max(...dados.map((item) => item.valor), 0);
  const formatarValor = formato === "moeda" ? (valor: number) => formatarMoeda(String(valor)) : undefined;

  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <XAxis
            dataKey="rotulo"
            tick={{ fill: "var(--color-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={dados.length > 5 ? -20 : 0}
            textAnchor={dados.length > 5 ? "end" : "middle"}
            height={dados.length > 5 ? 48 : 24}
          />
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
          <Bar dataKey="valor" radius={[8, 8, 0, 0]} maxBarSize={48}>
            {dados.map((item, indice) => (
              <Cell
                key={indice}
                fill={item.valor === valorMaximo ? "var(--color-primary)" : "var(--color-primary-light)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
