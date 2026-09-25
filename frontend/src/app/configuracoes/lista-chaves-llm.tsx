"use client";

import { useRef, useState, useTransition } from "react";
import { Switch } from "@/components/design/switch";
import { PrimaryButton } from "@/components/design/button";
import type { ChaveLlmDto } from "@/lib/configuracoes";
import {
  atualizarChaveLlm,
  criarChaveLlm,
  removerChaveLlm,
  reordenarChavesLlm,
} from "./actions";

// Lista de chaves de LLM com fallback em cadeia (pedido explicito do
// usuario, 2026-09-24: "podendo arrastar pra cima e pra baixo pra alterar
// a ordem") - drag-and-drop nativo HTML5 (sem lib nova no projeto, mesmo
// criterio de nunca introduzir dependencia so' por isso). Ordem na tela =
// ordem de tentativa no backend (LlmClientService.gerarJson), primeira
// ativa da lista tentada primeiro.
export function ListaChavesLlm({ inicial }: { inicial: ChaveLlmDto[] }) {
  const [chaves, setChaves] = useState(inicial);
  const [rotuloNovo, setRotuloNovo] = useState("");
  const [apiKeyNova, setApiKeyNova] = useState("");
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const arrastandoId = useRef<string | null>(null);

  function adicionar() {
    const rotulo = rotuloNovo.trim();
    const apiKey = apiKeyNova.trim();
    if (!rotulo || !apiKey) {
      setErro("Informe rótulo e chave.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      try {
        const criada = await criarChaveLlm({ rotulo, apiKey });
        setChaves((atual) => [...atual, criada]);
        setRotuloNovo("");
        setApiKeyNova("");
      } catch {
        setErro("Falha ao adicionar a chave.");
      }
    });
  }

  function alternarAtiva(chave: ChaveLlmDto) {
    const novoValor = !chave.ativa;
    setChaves((atual) => atual.map((c) => (c.id === chave.id ? { ...c, ativa: novoValor } : c)));
    startTransition(async () => {
      try {
        await atualizarChaveLlm(chave.id, { ativa: novoValor });
      } catch {
        setChaves((atual) => atual.map((c) => (c.id === chave.id ? { ...c, ativa: !novoValor } : c)));
        setErro("Falha ao salvar - tente novamente.");
      }
    });
  }

  function remover(id: string) {
    const anterior = chaves;
    setChaves((atual) => atual.filter((c) => c.id !== id));
    startTransition(async () => {
      try {
        await removerChaveLlm(id);
      } catch {
        setChaves(anterior);
        setErro("Falha ao remover - tente novamente.");
      }
    });
  }

  function persistirOrdem(novaLista: ChaveLlmDto[]) {
    startTransition(async () => {
      try {
        await reordenarChavesLlm(novaLista.map((c) => c.id));
      } catch {
        setErro("Falha ao salvar a nova ordem - tente novamente.");
      }
    });
  }

  // Bug corrigido (2026-09-25): persistirOrdem() (que chama startTransition,
  // um efeito colateral) estava sendo disparado de DENTRO do updater de
  // setChaves - React trata o updater como funcao pura chamada durante o
  // render, entao disparar um setState/transition la dentro derrubava a
  // tela com erro assim que o card era solto. Agora o novo array e'
  // calculado a partir do `chaves` atual, e setChaves()/persistirOrdem()
  // sao chamados como dois passos separados, fora do updater.
  function soltar(idAlvo: string) {
    const idOrigem = arrastandoId.current;
    arrastandoId.current = null;
    if (!idOrigem || idOrigem === idAlvo) return;

    const indiceOrigem = chaves.findIndex((c) => c.id === idOrigem);
    const indiceAlvo = chaves.findIndex((c) => c.id === idAlvo);
    if (indiceOrigem === -1 || indiceAlvo === -1) return;

    const novaLista = [...chaves];
    const [movida] = novaLista.splice(indiceOrigem, 1);
    novaLista.splice(indiceAlvo, 0, movida);

    setChaves(novaLista);
    persistirOrdem(novaLista);
  }

  return (
    <div className="flex flex-col gap-4">
      {chaves.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma chave cadastrada ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {chaves.map((chave, indice) => (
            <li
              key={chave.id}
              draggable
              onDragStart={() => {
                arrastandoId.current = chave.id;
              }}
              onDragOver={(evento) => evento.preventDefault()}
              onDrop={() => soltar(chave.id)}
              className="flex items-center gap-3 rounded-card bg-background px-4 py-3 text-sm"
            >
              <span className="cursor-grab select-none text-muted" title="Arrastar para reordenar">
                ⠿
              </span>
              <span className="w-6 text-xs font-semibold text-muted">{indice + 1}º</span>
              <div className="flex-1">
                <p className="font-medium text-ink">{chave.rotulo}</p>
                <p className="text-xs text-muted">{chave.chavePreview}</p>
              </div>
              <Switch
                checked={chave.ativa}
                disabled={pending}
                label={chave.ativa ? "Ativa" : "Inativa"}
                onChange={() => alternarAtiva(chave)}
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => remover(chave.id)}
                className="text-xs text-muted hover:text-ink disabled:pointer-events-none disabled:opacity-40"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3 border-t border-black/5 pt-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Rótulo
          <input
            type="text"
            value={rotuloNovo}
            onChange={(evento) => setRotuloNovo(evento.target.value)}
            placeholder="Ex: Conta principal"
            className="w-48 rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Chave de API
          <input
            type="password"
            value={apiKeyNova}
            onChange={(evento) => setApiKeyNova(evento.target.value)}
            placeholder="Colar a chave de API"
            autoComplete="off"
            className="w-64 rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          />
        </label>
        <PrimaryButton type="button" onClick={adicionar} disabled={pending}>
          {pending ? "Salvando..." : "Adicionar chave"}
        </PrimaryButton>
      </div>
      {erro && <p className="text-xs font-medium text-ink">{erro}</p>}
    </div>
  );
}
