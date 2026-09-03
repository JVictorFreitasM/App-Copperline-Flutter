"use client";

import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

// Cores de série reaproveitadas do design system (mesma paleta de
// grafico-barras.tsx: primary/laranja/verde/vermelho) - até 4 vendedores
// (OS-WEB-40), uma cor fixa por posição, não por vendedor específico.
const CORES_SERIE = ["#1667D9", "#B45309", "#15803D", "#B42318"];

export interface EixoGraficoRadar {
  chave: string;
  rotulo: string;
}

export interface SerieGraficoRadar {
  nome: string;
  valores: Record<string, number>;
}

// Cada eixo tem escala própria (R$, %, contagem) - plotar valor bruto no
// mesmo radar distorceria a comparação (o eixo de maior escala dominaria
// visualmente). Normaliza cada eixo pro maior valor ENTRE OS VENDEDORES
// SELECIONADOS virar 100% - comparação relativa entre eles, não uma escala
// absoluta inventada. O valor bruto de cada vendedor fica disponível no
// tooltip.
export function GraficoRadar({
  eixos,
  series,
  altura = 320,
}: {
  eixos: EixoGraficoRadar[];
  series: SerieGraficoRadar[];
  altura?: number;
}) {
  const maximoPorEixo = new Map(
    eixos.map((eixo) => [
      eixo.chave,
      Math.max(1, ...series.map((serie) => serie.valores[eixo.chave] ?? 0)),
    ]),
  );

  const dados = eixos.map((eixo) => {
    const linha: Record<string, string | number> = { eixo: eixo.rotulo };
    for (const serie of series) {
      const bruto = serie.valores[eixo.chave] ?? 0;
      linha[serie.nome] = Math.round((bruto / (maximoPorEixo.get(eixo.chave) ?? 1)) * 100);
      linha[`${serie.nome}__bruto`] = bruto;
    }
    return linha;
  });

  return (
    <ResponsiveContainer width="100%" height={altura}>
      <RadarChart data={dados} outerRadius="70%">
        <PolarGrid stroke="#E2E8F0" />
        <PolarAngleAxis dataKey="eixo" tick={{ fontSize: 12, fill: "#475569" }} />
        {series.map((serie, indice) => (
          <Radar
            key={serie.nome}
            name={serie.nome}
            dataKey={serie.nome}
            stroke={CORES_SERIE[indice % CORES_SERIE.length]}
            fill={CORES_SERIE[indice % CORES_SERIE.length]}
            fillOpacity={0.15}
            strokeWidth={2}
          />
        ))}
        <Legend />
        <Tooltip formatter={(_valor, nome, item) => [item.payload[`${nome}__bruto`], nome]} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
