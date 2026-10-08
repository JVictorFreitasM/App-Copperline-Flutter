"use client";

import { useRef, useState, useTransition } from "react";
import { PrimaryButton } from "@/components/design/button";
import { Switch } from "@/components/design/switch";
import type { ProvedorApiDto, TipoProvedorApi } from "@/lib/configuracoes";
import {
  atualizarProvedorApi,
  criarProvedorApi,
  removerProvedorApi,
  reordenarProvedoresApi,
} from "./actions";

const SECOES: { tipo: TipoProvedorApi; titulo: string; descricao: string }[] = [
  {
    tipo: "CNPJ",
    titulo: "Consulta de CNPJ",
    descricao:
      "Tentados na ordem. Provedor com limite (ex: ReceitaWS, 3 por minuto) só é usado enquanto sobrar cota; acabou ou falhou, vai para o próximo.",
  },
  {
    tipo: "CEP",
    titulo: "Consulta de CEP",
    descricao: "Tentados na ordem; se um falhar, o próximo é usado. CEP inexistente não tenta os demais.",
  },
  {
    tipo: "GEOCODIFICACAO",
    titulo: "Mapa (localizar endereço)",
    descricao: "Endereço em texto para coordenada. Se um não achar ou falhar, tenta o próximo.",
  },
];

const FORMATOS: Record<TipoProvedorApi, { valor: string; rotulo: string }[]> = {
  CNPJ: [
    { valor: "RECEITAWS", rotulo: "ReceitaWS (token opcional)" },
    { valor: "BRASILAPI", rotulo: "BrasilAPI" },
  ],
  CEP: [
    { valor: "MILEENA", rotulo: "Mileena" },
    { valor: "VIACEP", rotulo: "ViaCEP" },
  ],
  GEOCODIFICACAO: [{ valor: "NOMINATIM", rotulo: "Nominatim (OpenStreetMap)" }],
};

// Aba "Provedores de API": endpoints das APIs externas de consulta, vários por
// tipo, com fallback em cadeia (ordem da lista = ordem de tentativa; arraste para
// reordenar) - mesmo desenho da lista de chaves de LLM. O "formato" diz qual
// adaptador lê a resposta; token nunca volta do servidor.
export function AbaProvedoresApi({ inicial }: { inicial: ProvedorApiDto[] }) {
  const [provedores, setProvedores] = useState(inicial);

  function substituirTipo(tipo: TipoProvedorApi, lista: ProvedorApiDto[]) {
    setProvedores((atual) => [...atual.filter((p) => p.tipo !== tipo), ...lista]);
  }

  return (
    <div className="flex flex-col gap-10">
      {SECOES.map((secao) => (
        <SecaoTipo
          key={secao.tipo}
          tipo={secao.tipo}
          titulo={secao.titulo}
          descricao={secao.descricao}
          lista={provedores.filter((p) => p.tipo === secao.tipo).sort((a, b) => a.ordem - b.ordem)}
          aoMudar={(lista) => substituirTipo(secao.tipo, lista)}
        />
      ))}
    </div>
  );
}

function SecaoTipo({
  tipo,
  titulo,
  descricao,
  lista,
  aoMudar,
}: {
  tipo: TipoProvedorApi;
  titulo: string;
  descricao: string;
  lista: ProvedorApiDto[];
  aoMudar: (lista: ProvedorApiDto[]) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const arrastandoId = useRef<string | null>(null);

  function soltar(idAlvo: string) {
    const idOrigem = arrastandoId.current;
    arrastandoId.current = null;
    if (!idOrigem || idOrigem === idAlvo) return;
    const origem = lista.findIndex((p) => p.id === idOrigem);
    const alvo = lista.findIndex((p) => p.id === idAlvo);
    if (origem === -1 || alvo === -1) return;
    const nova = [...lista];
    const [movido] = nova.splice(origem, 1);
    nova.splice(alvo, 0, movido);
    aoMudar(nova.map((p, i) => ({ ...p, ordem: i })));
    startTransition(async () => {
      try {
        await reordenarProvedoresApi(tipo, nova.map((p) => p.id));
      } catch {
        setErro("Falha ao salvar a nova ordem.");
      }
    });
  }

  function alternarAtiva(provedor: ProvedorApiDto) {
    const ativa = !provedor.ativa;
    aoMudar(lista.map((p) => (p.id === provedor.id ? { ...p, ativa } : p)));
    startTransition(async () => {
      try {
        await atualizarProvedorApi(provedor.id, { ativa });
      } catch {
        aoMudar(lista);
        setErro("Falha ao salvar.");
      }
    });
  }

  function remover(id: string) {
    const anterior = lista;
    aoMudar(lista.filter((p) => p.id !== id));
    startTransition(async () => {
      try {
        await removerProvedorApi(id);
      } catch {
        aoMudar(anterior);
        setErro("Falha ao remover.");
      }
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold text-ink">{titulo}</h2>
        <p className="text-xs text-muted">{descricao}</p>
      </div>

      {lista.length === 0 ? (
        <p className="text-sm text-muted">Nenhum provedor. Sem provedor ativo, essa consulta fica indisponível.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((provedor, indice) => (
            <li
              key={provedor.id}
              draggable={editandoId !== provedor.id}
              onDragStart={() => {
                arrastandoId.current = provedor.id;
              }}
              onDragOver={(evento) => evento.preventDefault()}
              onDrop={() => soltar(provedor.id)}
              className="flex flex-col gap-3 rounded-card bg-background px-4 py-3 text-sm"
            >
              <div className="flex items-center gap-3">
                <span className="cursor-grab select-none text-muted" title="Arrastar para reordenar">
                  ⠿
                </span>
                <span className="w-6 text-xs font-semibold text-muted">{indice + 1}º</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">
                    {provedor.rotulo} <span className="text-xs font-normal text-muted">({provedor.formato})</span>
                  </p>
                  <p className="truncate text-xs text-muted">
                    {provedor.urlBase}
                    {provedor.tokenDefinido ? " · token definido" : ""}
                    {provedor.limiteRequisicoes && provedor.janelaSegundos
                      ? ` · limite ${provedor.limiteRequisicoes}/${provedor.janelaSegundos}s`
                      : ""}
                  </p>
                </div>
                <Switch
                  checked={provedor.ativa}
                  disabled={pending}
                  label={provedor.ativa ? "Ativo" : "Inativo"}
                  onChange={() => alternarAtiva(provedor)}
                />
                <button
                  type="button"
                  onClick={() => setEditandoId(editandoId === provedor.id ? null : provedor.id)}
                  className="text-xs text-muted hover:text-ink"
                >
                  {editandoId === provedor.id ? "Fechar" : "Editar"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remover(provedor.id)}
                  className="text-xs text-muted hover:text-ink disabled:pointer-events-none disabled:opacity-40"
                >
                  Remover
                </button>
              </div>
              {editandoId === provedor.id && (
                <FormularioProvedor
                  inicial={provedor}
                  rotuloBotao="Salvar alterações"
                  aoSalvar={async (valores) => {
                    const atualizado = await atualizarProvedorApi(provedor.id, valores);
                    aoMudar(lista.map((p) => (p.id === provedor.id ? atualizado : p)));
                    setEditandoId(null);
                  }}
                  aoErro={setErro}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <details className="rounded-card border border-black/5 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-ink">Adicionar provedor</summary>
        <div className="mt-3">
          <FormularioProvedor
            formatos={FORMATOS[tipo]}
            rotuloBotao="Adicionar"
            aoSalvar={async (valores) => {
              const criado = await criarProvedorApi({
                tipo,
                formato: valores.formato ?? FORMATOS[tipo][0].valor,
                rotulo: valores.rotulo ?? "",
                urlBase: valores.urlBase ?? "",
                token: valores.token || undefined,
                limiteRequisicoes: valores.limiteRequisicoes ?? undefined,
                janelaSegundos: valores.janelaSegundos ?? undefined,
              });
              aoMudar([...lista, criado]);
            }}
            aoErro={setErro}
          />
        </div>
      </details>
      {erro && <p className="text-xs font-medium text-ink">{erro}</p>}
    </section>
  );
}

interface ValoresFormulario {
  formato?: string;
  rotulo?: string;
  urlBase?: string;
  token?: string;
  limiteRequisicoes?: number | null;
  janelaSegundos?: number | null;
}

function FormularioProvedor({
  inicial,
  formatos,
  rotuloBotao,
  aoSalvar,
  aoErro,
}: {
  inicial?: ProvedorApiDto;
  formatos?: { valor: string; rotulo: string }[];
  rotuloBotao: string;
  aoSalvar: (valores: ValoresFormulario) => Promise<void>;
  aoErro: (mensagem: string | null) => void;
}) {
  const [formato, setFormato] = useState(formatos?.[0]?.valor ?? "");
  const [rotulo, setRotulo] = useState(inicial?.rotulo ?? "");
  const [urlBase, setUrlBase] = useState(inicial?.urlBase ?? "");
  const [token, setToken] = useState("");
  const [limite, setLimite] = useState(inicial?.limiteRequisicoes?.toString() ?? "");
  const [janela, setJanela] = useState(inicial?.janelaSegundos?.toString() ?? "");
  const [pending, startTransition] = useTransition();

  function enviar() {
    if (!rotulo.trim() || !urlBase.trim()) {
      aoErro("Informe rótulo e URL.");
      return;
    }
    const temLimite = limite.trim() !== "" || janela.trim() !== "";
    if (temLimite && (!Number(limite) || !Number(janela))) {
      aoErro("Para limitar, informe limite e janela (em segundos).");
      return;
    }
    aoErro(null);
    startTransition(async () => {
      try {
        await aoSalvar({
          formato,
          rotulo,
          urlBase,
          // Edição: vazio = mantém o token atual (só troca se digitar algo).
          ...(token ? { token } : {}),
          limiteRequisicoes: temLimite ? Number(limite) : null,
          janelaSegundos: temLimite ? Number(janela) : null,
        });
        if (!inicial) {
          setRotulo("");
          setUrlBase("");
          setToken("");
          setLimite("");
          setJanela("");
        }
      } catch {
        aoErro("Não foi possível salvar. Confira a URL e o formato.");
      }
    });
  }

  const classeInput =
    "rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light";

  return (
    <div className="flex flex-wrap items-end gap-3">
      {formatos && (
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Formato
          <select value={formato} onChange={(e) => setFormato(e.target.value)} className={classeInput}>
            {formatos.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.rotulo}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Rótulo
        <input value={rotulo} onChange={(e) => setRotulo(e.target.value)} className={`${classeInput} w-44`} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        URL base
        <input
          value={urlBase}
          onChange={(e) => setUrlBase(e.target.value)}
          placeholder="https://..."
          className={`${classeInput} w-72`}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Token (opcional)
        <input
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={inicial?.tokenDefinido ? "•••• (manter)" : ""}
          className={`${classeInput} w-44`}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Limite
        <input
          type="number"
          min={1}
          value={limite}
          onChange={(e) => setLimite(e.target.value)}
          placeholder="sem limite"
          className={`${classeInput} w-24`}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Janela (s)
        <input
          type="number"
          min={1}
          value={janela}
          onChange={(e) => setJanela(e.target.value)}
          placeholder="60"
          className={`${classeInput} w-24`}
        />
      </label>
      <PrimaryButton type="button" onClick={enviar} disabled={pending}>
        {pending ? "Salvando..." : rotuloBotao}
      </PrimaryButton>
    </div>
  );
}
