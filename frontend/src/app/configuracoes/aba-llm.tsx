"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/design/switch";
import type { ChaveLlmDto, ConfiguracaoLlmDto } from "@/lib/configuracoes";
import { atualizarConfiguracaoLlm } from "./actions";
import { LinhaConfiguracao, CampoTexto, RodapeSalvar } from "./campos";
import { ListaChavesLlm } from "./lista-chaves-llm";

// Aba "LLM" (2026-09-24, unificada com as outras 3 - antes vivia sozinha em
// /admin/llm). Chave em si usada pelas funcionalidades de LLM (resumo de
// cliente/visita, oportunidades, etc) fica na lista de fallback abaixo, nao
// mais um campo unico aqui.
export function AbaLlm({
  configuracaoInicial,
  chavesIniciais,
}: {
  configuracaoInicial: ConfiguracaoLlmDto;
  chavesIniciais: ChaveLlmDto[];
}) {
  const [valores, setValores] = useState(configuracaoInicial);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  // Fallback (switch) fica FORA do fluxo de "Salvar" dos campos de texto
  // acima - persiste na hora, mesmo criterio de PermiteCheckinToggle/
  // RankingVisivelToggle (toggle isolado, estado otimista revertido se a
  // chamada falhar).
  const [fallbackPending, startFallbackTransition] = useTransition();
  const [erroFallback, setErroFallback] = useState<string | null>(null);

  const alterado =
    valores.provedor !== configuracaoInicial.provedor ||
    valores.modelo !== configuracaoInicial.modelo;

  function salvar() {
    setErro(null);
    setSucesso(false);
    startTransition(async () => {
      try {
        const atualizado = await atualizarConfiguracaoLlm({
          provedor: valores.provedor,
          modelo: valores.modelo,
          fallbackAtivo: valores.fallbackAtivo,
        });
        setValores(atualizado);
        setSucesso(true);
      } catch {
        setErro("Falha ao salvar.");
      }
    });
  }

  function alternarFallback() {
    const novoValor = !valores.fallbackAtivo;
    setValores((atual) => ({ ...atual, fallbackAtivo: novoValor }));
    setErroFallback(null);
    startFallbackTransition(async () => {
      try {
        await atualizarConfiguracaoLlm({
          provedor: valores.provedor,
          modelo: valores.modelo,
          fallbackAtivo: novoValor,
        });
      } catch {
        setValores((atual) => ({ ...atual, fallbackAtivo: !novoValor }));
        setErroFallback("Falha ao salvar - tente novamente.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col divide-y divide-black/5">
        <LinhaConfiguracao
          titulo="Provedor"
          descricao="Gateway usado pra chamar o modelo (ex: openrouter)."
        >
          <CampoTexto
            valor={valores.provedor}
            disabled={pending}
            onChange={(valor) => setValores((atual) => ({ ...atual, provedor: valor }))}
          />
        </LinhaConfiguracao>

        <LinhaConfiguracao
          titulo="Modelo"
          descricao="Ex: anthropic/claude-opus-5 - usado por todas as chaves da lista abaixo."
        >
          <CampoTexto
            valor={valores.modelo}
            disabled={pending}
            onChange={(valor) => setValores((atual) => ({ ...atual, modelo: valor }))}
          />
        </LinhaConfiguracao>

        <RodapeSalvar
          visivel={alterado}
          pending={pending}
          erro={erro}
          sucesso={sucesso}
          onSalvar={salvar}
        />
      </div>

      <div>
        <p className="mb-1 text-sm font-semibold text-ink">Chaves de API</p>
        <p className="mb-4 text-xs text-muted">
          Tentadas em ordem - se a primeira ativa falhar (limite, chave revogada), a próxima da
          lista é usada. Arraste para reordenar.
        </p>

        <div className="mb-4 flex items-center justify-between gap-4 rounded-card bg-background px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink">Fallback entre chaves</p>
            <p className="text-xs text-muted">
              {valores.fallbackAtivo
                ? "Ligado - se a chave da vez falhar, tenta a próxima da lista."
                : "Desligado - usa só a primeira chave ativa; se ela falhar, o erro é repassado direto."}
            </p>
            {erroFallback && <p className="mt-1 text-xs font-medium text-ink">{erroFallback}</p>}
          </div>
          <Switch
            checked={valores.fallbackAtivo}
            disabled={fallbackPending}
            label="Fallback entre chaves"
            onChange={alternarFallback}
          />
        </div>

        <ListaChavesLlm inicial={chavesIniciais} />
      </div>
    </div>
  );
}
