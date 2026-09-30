"use client";

import { useActionState, useRef, useState } from "react";
import { PrimaryButton } from "@/components/design/button";
import { Card } from "@/components/design/card";
import type { TipoAcondicionamentoDto } from "@/lib/tipos-acondicionamento";
import {
  buscarProdutosParaImagem,
  enviarImagemProduto,
  obterProdutoParaImagem,
  type ProdutoBuscaImagem,
} from "./actions";
import { EditarPrecoFabricacaoForm } from "./editar-preco-fabricacao-form";
import { EditarTipoAcondicionamentoForm } from "./editar-tipo-acondicionamento-form";
import { ESTADO_EDICAO_MANUAL_INICIAL } from "./estado-produtos-admin";

const DEBOUNCE_MS = 300;

interface ProdutoSelecionado extends ProdutoBuscaImagem {
  temImagem: boolean;
  precoFabricacao: string | null;
  tipoAcondicionamentoId: string | null;
}

// Consolida os 3 campos que NAO vem do WK Radar (preço de fabricação,
// tipo de acondicionamento, imagem) - movido de produtos/[id] pro admin
// (pedido do usuário, 2026-09-29). Busca o produto por nome/código (mesmo
// padrão de SelecionarItemPopup em pedidos/novo, só que sem popup - lista
// inline mesmo, área pequena o bastante pra não precisar de modal).
export function DadosAdministrativosProduto({
  tiposAcondicionamento,
}: {
  tiposAcondicionamento: TipoAcondicionamentoDto[];
}) {
  const [query, setQuery] = useState("");
  const [opcoes, setOpcoes] = useState<ProdutoBuscaImagem[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [selecionado, setSelecionado] = useState<ProdutoSelecionado | null>(null);
  // Cache-busting da preview - o browser não sabe sozinho que a imagem por
  // trás da MESMA url (/api/produtos/:id/imagem) mudou depois de um envio
  // bem-sucedido.
  const [versaoImagem, setVersaoImagem] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onMudarQuery(valor: string) {
    setQuery(valor);
    setSelecionado(null);
    if (timer.current) clearTimeout(timer.current);
    if (!valor.trim()) {
      setOpcoes([]);
      return;
    }
    setBuscando(true);
    timer.current = setTimeout(async () => {
      const resultado = await buscarProdutosParaImagem(valor);
      setOpcoes(resultado);
      setBuscando(false);
    }, DEBOUNCE_MS);
  }

  async function selecionar(produto: ProdutoBuscaImagem) {
    setOpcoes([]);
    setQuery(`${produto.nome ?? "—"}${produto.codigo ? ` (${produto.codigo})` : ""}`);
    const detalhe = await obterProdutoParaImagem(produto.id);
    setVersaoImagem(0);
    setSelecionado({
      ...produto,
      temImagem: detalhe?.temImagem ?? false,
      precoFabricacao: detalhe?.precoFabricacao ?? null,
      tipoAcondicionamentoId: detalhe?.tipoAcondicionamentoId ?? null,
    });
  }

  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold text-ink">Dados administrativos (não vêm do ERP)</h2>
      <p className="mb-3 text-xs text-muted">
        Busque um produto por nome ou código pra editar preço de fabricação, tipo de acondicionamento
        e imagem.
      </p>

      <input
        type="text"
        value={query}
        onChange={(evento) => onMudarQuery(evento.target.value)}
        placeholder="Buscar produto por nome ou código..."
        className="w-full max-w-md rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
      />

      {buscando && <p className="mt-2 text-xs text-muted">Buscando...</p>}
      {!buscando && opcoes.length > 0 && (
        <ul className="mt-2 flex max-w-md flex-col divide-y divide-line rounded-2xl bg-background">
          {opcoes.map((opcao) => (
            <li key={opcao.id}>
              <button
                type="button"
                onClick={() => selecionar(opcao)}
                className="w-full px-4 py-2 text-left text-sm text-ink hover:bg-surface"
              >
                {opcao.nome ?? "—"}
                {opcao.codigo ? ` (${opcao.codigo})` : ""}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selecionado && (
        <div className="mt-4 flex flex-col gap-4 rounded-2xl bg-background p-4">
          <div className="flex flex-wrap items-center gap-4">
            {selecionado.temImagem && (
              // eslint-disable-next-line @next/next/no-img-element -- imagem enviada pelo usuário, sem otimização/CDN configurados pra upload dinâmico
              <img
                src={`/api/produtos/${selecionado.id}/imagem?v=${versaoImagem}`}
                alt={selecionado.nome ?? "Produto"}
                className="h-20 w-20 rounded-xl object-cover"
              />
            )}
            <div className="flex flex-1 flex-col gap-2">
              <p className="text-sm font-medium text-ink">
                {selecionado.nome ?? "—"}
                {selecionado.codigo ? ` (${selecionado.codigo})` : ""}
              </p>
              <EnviarImagemProdutoForm
                produtoId={selecionado.id}
                onEnviado={() => {
                  setSelecionado((atual) => (atual ? { ...atual, temImagem: true } : atual));
                  setVersaoImagem((atual) => atual + 1);
                }}
              />
            </div>
          </div>

          <EditarPrecoFabricacaoForm
            produtoId={selecionado.id}
            valorAtual={selecionado.precoFabricacao}
          />
          <EditarTipoAcondicionamentoForm
            produtoId={selecionado.id}
            tipoAtualId={selecionado.tipoAcondicionamentoId}
            opcoes={tiposAcondicionamento}
          />
        </div>
      )}
    </Card>
  );
}

function EnviarImagemProdutoForm({
  produtoId,
  onEnviado,
}: {
  produtoId: string;
  onEnviado: () => void;
}) {
  const acaoComId = enviarImagemProduto.bind(null, produtoId);
  const [estado, acao, pending] = useActionState(async (estadoAnterior: typeof ESTADO_EDICAO_MANUAL_INICIAL, formData: FormData) => {
    const resultado = await acaoComId(estadoAnterior, formData);
    if (resultado.sucesso) {
      onEnviado();
    }
    return resultado;
  }, ESTADO_EDICAO_MANUAL_INICIAL);

  return (
    <form action={acao} className="flex flex-wrap items-end gap-3">
      <label className="flex w-72 flex-col gap-1 text-xs font-medium text-muted">
        Imagem do produto
        <input
          type="file"
          name="imagem"
          required
          accept="image/jpeg,image/png,image/webp"
          className="text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-solid file:px-4 file:py-2 file:text-sm file:font-medium file:text-on-solid"
        />
      </label>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Enviar imagem"}
      </PrimaryButton>
      {estado.sucesso && <p className="text-xs font-medium text-ink">{estado.sucesso}</p>}
      {estado.erro && <p className="text-xs font-medium text-muted">{estado.erro}</p>}
    </form>
  );
}
