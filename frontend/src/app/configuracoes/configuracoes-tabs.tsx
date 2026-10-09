"use client";

import { useState } from "react";
import type {
  AlcadaAprovacaoDto,
  ChaveLlmDto,
  CredencialErpDto,
  ProvedorApiDto,
  ComunicadoPedidoPdfDto,
  ConfiguracaoFuncionalidadesDto,
  ConfiguracaoLlmDto,
  ConfiguracaoOrcamentoDto,
  ConfiguracaoRastreioDto,
  DadosEmpresaPdfDto,
} from "@/lib/configuracoes";
import { Card } from "@/components/design/card";
import { AbaAlcadaAprovacao } from "./aba-alcada-aprovacao";
import { AbaDocumentoPedido } from "./aba-documento-pedido";
import { AbaFuncionalidades } from "./aba-funcionalidades";
import { AbaIntegracaoErp } from "./aba-integracao-erp";
import { AbaLlm } from "./aba-llm";
import { AbaOrcamento } from "./aba-orcamento";
import { AbaProvedoresApi } from "./aba-provedores-api";
import { AbaRastreio } from "./aba-rastreio";

type Aba = "orcamento" | "rastreio" | "alcada" | "llm" | "documento-pedido" | "funcionalidades" | "integracao-erp" | "provedores-api";

// Abas agrupadas por assunto (dois niveis: grupo -> aba) - a barra unica de 8
// abas ficou longa demais. Mesmas telas de antes, so reorganizadas.
const GRUPOS: { id: string; rotulo: string; abas: { id: Aba; rotulo: string }[] }[] = [
  {
    id: "comercial",
    rotulo: "Comercial",
    abas: [
      { id: "orcamento", rotulo: "Orçamento" },
      { id: "alcada", rotulo: "Alçada de aprovação" },
      { id: "documento-pedido", rotulo: "Documento do Pedido" },
    ],
  },
  {
    id: "operacao",
    rotulo: "Operação",
    abas: [
      { id: "funcionalidades", rotulo: "Funcionalidades" },
      { id: "rastreio", rotulo: "Rastreio" },
    ],
  },
  {
    id: "integracoes",
    rotulo: "Integrações",
    abas: [
      { id: "integracao-erp", rotulo: "ERP (WK Radar)" },
      { id: "provedores-api", rotulo: "Provedores de API" },
      { id: "llm", rotulo: "LLM" },
    ],
  },
];

export function ConfiguracoesTabs({
  alcadaInicial,
  orcamentoInicial,
  rastreioInicial,
  llmInicial,
  chavesLlmIniciais,
  empresaPdfInicial,
  comunicadoPdfInicial,
  funcionalidadesInicial,
  credenciaisErpIniciais,
  provedoresApiIniciais,
}: {
  alcadaInicial: AlcadaAprovacaoDto;
  orcamentoInicial: ConfiguracaoOrcamentoDto;
  rastreioInicial: ConfiguracaoRastreioDto;
  llmInicial: ConfiguracaoLlmDto;
  chavesLlmIniciais: ChaveLlmDto[];
  empresaPdfInicial: DadosEmpresaPdfDto;
  comunicadoPdfInicial: ComunicadoPedidoPdfDto;
  funcionalidadesInicial: ConfiguracaoFuncionalidadesDto;
  credenciaisErpIniciais: CredencialErpDto[];
  provedoresApiIniciais: ProvedorApiDto[];
}) {
  const [abaAtiva, setAbaAtiva] = useState<Aba>("orcamento");
  const grupoAtivo = GRUPOS.find((grupo) => grupo.abas.some((aba) => aba.id === abaAtiva)) ?? GRUPOS[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {GRUPOS.map((grupo) => (
            <button
              key={grupo.id}
              type="button"
              onClick={() => setAbaAtiva(grupo.abas[0].id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                grupoAtivo.id === grupo.id ? "bg-solid text-on-solid" : "bg-surface text-muted shadow-sm hover:text-ink"
              }`}
            >
              {grupo.rotulo}
            </button>
          ))}
        </div>
        <div className="flex gap-6 border-b border-ink/5">
          {grupoAtivo.abas.map((aba) => (
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
      </div>

      <Card>
        {abaAtiva === "alcada" && <AbaAlcadaAprovacao inicial={alcadaInicial} />}
        {abaAtiva === "orcamento" && <AbaOrcamento inicial={orcamentoInicial} />}
        {abaAtiva === "funcionalidades" && <AbaFuncionalidades inicial={funcionalidadesInicial} />}
        {abaAtiva === "integracao-erp" && <AbaIntegracaoErp inicial={credenciaisErpIniciais} />}
        {abaAtiva === "provedores-api" && <AbaProvedoresApi inicial={provedoresApiIniciais} />}
        {abaAtiva === "rastreio" && <AbaRastreio inicial={rastreioInicial} />}
        {abaAtiva === "llm" && (
          <AbaLlm configuracaoInicial={llmInicial} chavesIniciais={chavesLlmIniciais} />
        )}
        {abaAtiva === "documento-pedido" && (
          <AbaDocumentoPedido
            empresaInicial={empresaPdfInicial}
            comunicadoInicial={comunicadoPdfInicial}
          />
        )}
      </Card>
    </div>
  );
}
