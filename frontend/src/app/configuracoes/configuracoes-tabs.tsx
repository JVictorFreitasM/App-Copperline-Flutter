"use client";

import { useState } from "react";
import type {
  AlcadaAprovacaoDto,
  ChaveLlmDto,
  ConfiguracaoLlmDto,
  ConfiguracaoOrcamentoDto,
  ConfiguracaoRastreioDto,
} from "@/lib/configuracoes";
import { Card } from "@/components/design/card";
import { AbaAlcadaAprovacao } from "./aba-alcada-aprovacao";
import { AbaLlm } from "./aba-llm";
import { AbaOrcamento } from "./aba-orcamento";
import { AbaRastreio } from "./aba-rastreio";

type Aba = "orcamento" | "rastreio" | "alcada" | "llm";

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "orcamento", rotulo: "Orçamento" },
  { id: "rastreio", rotulo: "Rastreio" },
  { id: "alcada", rotulo: "Alçada de aprovação" },
  { id: "llm", rotulo: "LLM" },
];

export function ConfiguracoesTabs({
  alcadaInicial,
  orcamentoInicial,
  rastreioInicial,
  llmInicial,
  chavesLlmIniciais,
}: {
  alcadaInicial: AlcadaAprovacaoDto;
  orcamentoInicial: ConfiguracaoOrcamentoDto;
  rastreioInicial: ConfiguracaoRastreioDto;
  llmInicial: ConfiguracaoLlmDto;
  chavesLlmIniciais: ChaveLlmDto[];
}) {
  const [abaAtiva, setAbaAtiva] = useState<Aba>("alcada");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-6 border-b border-ink/5">
        {ABAS.map((aba) => (
          <button
            key={aba.id}
            type="button"
            onClick={() => setAbaAtiva(aba.id)}
            className={`border-b-2 pb-3 text-sm font-medium transition ${
              abaAtiva === aba.id
                ? "border-primary text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {aba.rotulo}
          </button>
        ))}
      </div>

      <Card>
        {abaAtiva === "alcada" && <AbaAlcadaAprovacao inicial={alcadaInicial} />}
        {abaAtiva === "orcamento" && <AbaOrcamento inicial={orcamentoInicial} />}
        {abaAtiva === "rastreio" && <AbaRastreio inicial={rastreioInicial} />}
        {abaAtiva === "llm" && (
          <AbaLlm configuracaoInicial={llmInicial} chavesIniciais={chavesLlmIniciais} />
        )}
      </Card>
    </div>
  );
}
