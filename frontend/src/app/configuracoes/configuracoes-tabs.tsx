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

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "orcamento", rotulo: "Orçamento" },
  { id: "rastreio", rotulo: "Rastreio" },
  { id: "alcada", rotulo: "Alçada de aprovação" },
  { id: "llm", rotulo: "LLM" },
  { id: "documento-pedido", rotulo: "Documento do Pedido" },
  { id: "funcionalidades", rotulo: "Funcionalidades" },
  { id: "integracao-erp", rotulo: "Integração ERP" },
  { id: "provedores-api", rotulo: "Provedores de API" },
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
