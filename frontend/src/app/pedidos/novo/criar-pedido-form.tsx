"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/design/card";
import { formatarMoeda } from "@/lib/formatacao";
import type { CondicaoPagamentoDto, FormaPagamentoDto } from "@/lib/pagamento";
import { buscarClientes, buscarProdutos, calcularItem, criarPedido } from "./actions";
import type { OpcaoBusca } from "./tipos";

// Sem biblioteca de typeahead (projeto não tem nenhuma) - busca simples
// com debounce manual (setTimeout) chamando os Server Actions acima, que
// reaproveitam GET /clientes?nome=/GET /produtos?nome= (já existem, sem
// endpoint novo). "Criar orçamento" na listagem aponta pro mesmo
// formulário - o backend (CriarPedidoService) não distingue pedido de
// orçamento como fluxos diferentes hoje, então não finjo uma distinção
// que não existe.
const DEBOUNCE_MS = 300;

interface ItemLinha {
  chave: string;
  produto: OpcaoBusca | null;
  produtoQuery: string;
  opcoesProduto: OpcaoBusca[];
  buscandoProduto: boolean;
  // Nome do campo mantido (metrosDesejados) mas o VALOR digitado/exibido é
  // em KM (pedido do usuário, 2026-09-17: "100m = 0.1km") - convertido pra
  // metros só na hora de chamar a API (calcularItem/criarPedido), que
  // continua em metros (CriarPedidoItemDto.metrosDesejados).
  metrosDesejados: string;
  calculo: { quantidade: number; unidade: string; valorFinal: number } | null;
  erroCalculo: string | null;
  calculando: boolean;
}

const METROS_POR_KM = 1000;

// unidade "METRO" vem do backend em METROS (corte fracionário livre, ver
// calculo-quantidade-pedido.ts) - convertida aqui pra KM só pra exibição.
// "PECA" (rolo/peça fechada) não é distância, fica como está.
function formatarQuantidadeCalculo(calculo: { quantidade: number; unidade: string }): string {
  if (calculo.unidade === "METRO") {
    const km = calculo.quantidade / METROS_POR_KM;
    return `${km.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} KM`;
  }
  return `${calculo.quantidade} ${calculo.unidade}`;
}

function novoItem(): ItemLinha {
  return {
    // Sem crypto.randomUUID() de proposito - exige "secure context"
    // (HTTPS/localhost); a rede interna serve o site em HTTP puro num IP
    // (ex: http://192.168.2.202:3020), onde a API fica indisponivel e
    // quebra a tela inteira (TypeError). So precisa ser unica dentro
    // desta sessao do formulario (key de lista), nao criptograficamente
    // forte.
    chave: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    produto: null,
    produtoQuery: "",
    opcoesProduto: [],
    buscandoProduto: false,
    metrosDesejados: "",
    calculo: null,
    erroCalculo: null,
    calculando: false,
  };
}

export function CriarPedidoForm({
  formasPagamento,
  condicoesPagamento,
}: {
  formasPagamento: FormaPagamentoDto[];
  condicoesPagamento: CondicaoPagamentoDto[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [clienteQuery, setClienteQuery] = useState("");
  const [opcoesCliente, setOpcoesCliente] = useState<OpcaoBusca[]>([]);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [cliente, setCliente] = useState<OpcaoBusca | null>(null);

  const [itens, setItens] = useState<ItemLinha[]>([novoItem()]);
  const [percentualDesconto, setPercentualDesconto] = useState("0");
  const [formaPagamentoId, setFormaPagamentoId] = useState("");
  const [condicaoPagamentoId, setCondicaoPagamentoId] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const timerCliente = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timersItem = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function onMudarClienteQuery(valor: string) {
    setClienteQuery(valor);
    setCliente(null);
    if (timerCliente.current) clearTimeout(timerCliente.current);
    if (!valor.trim()) {
      setOpcoesCliente([]);
      return;
    }
    setBuscandoCliente(true);
    timerCliente.current = setTimeout(async () => {
      const resultado = await buscarClientes(valor);
      setOpcoesCliente(resultado);
      setBuscandoCliente(false);
    }, DEBOUNCE_MS);
  }

  function atualizarItem(chave: string, patch: Partial<ItemLinha>) {
    setItens((atual) => atual.map((item) => (item.chave === chave ? { ...item, ...patch } : item)));
  }

  function onMudarProdutoQuery(chave: string, valor: string) {
    atualizarItem(chave, { produtoQuery: valor, produto: null, calculo: null, erroCalculo: null });
    if (timersItem.current[chave]) clearTimeout(timersItem.current[chave]);
    if (!valor.trim()) {
      atualizarItem(chave, { opcoesProduto: [] });
      return;
    }
    atualizarItem(chave, { buscandoProduto: true });
    timersItem.current[chave] = setTimeout(async () => {
      const resultado = await buscarProdutos(valor);
      atualizarItem(chave, { opcoesProduto: resultado, buscandoProduto: false });
    }, DEBOUNCE_MS);
  }

  function selecionarProduto(chave: string, opcao: OpcaoBusca) {
    atualizarItem(chave, {
      produto: opcao,
      produtoQuery: opcao.label,
      opcoesProduto: [],
    });
  }

  async function onMudarMetros(chave: string, valor: string) {
    atualizarItem(chave, { metrosDesejados: valor, calculo: null, erroCalculo: null });
    const item = itens.find((i) => i.chave === chave);
    const produtoId = item?.produto?.id;
    const km = Number(valor);
    if (!produtoId || !valor || Number.isNaN(km) || km <= 0) return;

    atualizarItem(chave, { calculando: true });
    const resultado = await calcularItem(produtoId, km * METROS_POR_KM);
    if (resultado.status === "sucesso") {
      atualizarItem(chave, {
        calculando: false,
        calculo: {
          quantidade: resultado.resultado.quantidade,
          unidade: resultado.resultado.unidade,
          valorFinal: resultado.resultado.valorFinal,
        },
      });
    } else {
      atualizarItem(chave, { calculando: false, erroCalculo: resultado.mensagem });
    }
  }

  const subtotal = itens.reduce((soma, item) => soma + (item.calculo?.valorFinal ?? 0), 0);
  const desconto = Number(percentualDesconto) || 0;
  const totalComDesconto = subtotal * (1 - desconto / 100);

  function podeSubmeter(): boolean {
    if (!cliente || !formaPagamentoId || !condicaoPagamentoId || itens.length === 0) return false;
    return itens.every((item) => item.produto && item.calculo && !item.erroCalculo);
  }

  function onSubmit() {
    setErro(null);
    if (!cliente) {
      setErro("Selecione um cliente.");
      return;
    }
    if (!formaPagamentoId) {
      setErro("Selecione a forma de pagamento.");
      return;
    }
    if (!condicaoPagamentoId) {
      setErro("Selecione a condição de pagamento.");
      return;
    }
    const itensValidos = itens.filter((item) => item.produto && item.metrosDesejados);
    if (itensValidos.length === 0) {
      setErro("Adicione pelo menos um item.");
      return;
    }
    if (itensValidos.some((item) => !item.calculo)) {
      setErro("Aguarde o cálculo de todos os itens (ou corrija os que deram erro).");
      return;
    }

    startTransition(async () => {
      const resultado = await criarPedido({
        clienteId: cliente.id,
        percentualDesconto: desconto,
        formaPagamentoId,
        condicaoPagamentoId,
        itens: itensValidos.map((item) => ({
          produtoId: item.produto!.id,
          metrosDesejados: Number(item.metrosDesejados) * METROS_POR_KM,
        })),
      });

      if (resultado.status === "sucesso") {
        router.push(`/pedidos/${resultado.pedidoId}`);
        return;
      }
      setErro(resultado.mensagem ?? "Erro desconhecido ao criar o pedido.");
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <Card className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Cliente
          <input
            type="text"
            value={clienteQuery}
            onChange={(evento) => onMudarClienteQuery(evento.target.value)}
            placeholder="Buscar por nome..."
            className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          />
        </label>
        {cliente ? (
          <p className="text-sm text-ink">
            Selecionado: <span className="font-medium">{cliente.label}</span>
          </p>
        ) : (
          buscandoCliente ? (
            <p className="text-xs text-muted">Buscando...</p>
          ) : (
            opcoesCliente.length > 0 && (
              <ul className="flex flex-col gap-1">
                {opcoesCliente.map((opcao) => (
                  <li key={opcao.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCliente(opcao);
                        setClienteQuery(opcao.label);
                        setOpcoesCliente([]);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-background"
                    >
                      {opcao.label}
                    </button>
                  </li>
                ))}
              </ul>
            )
          )
        )}
      </Card>

      <h2 className="col-span-full text-lg font-semibold text-ink">Itens</h2>
      {itens.map((item) => (
          <Card key={item.chave} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
                Produto
                <input
                  type="text"
                  value={item.produtoQuery}
                  onChange={(evento) => onMudarProdutoQuery(item.chave, evento.target.value)}
                  placeholder="Buscar por nome..."
                  className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-muted">
                Quilômetros desejados
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={item.metrosDesejados}
                  disabled={!item.produto}
                  onChange={(evento) => onMudarMetros(item.chave, evento.target.value)}
                  className="w-36 rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light disabled:opacity-40"
                />
              </label>
              <button
                type="button"
                onClick={() => setItens((atual) => atual.filter((i) => i.chave !== item.chave))}
                className="px-2 text-sm text-muted hover:text-ink"
              >
                Remover
              </button>
            </div>
            {!item.produto && item.opcoesProduto.length > 0 && (
              <ul className="flex flex-col gap-1">
                {item.opcoesProduto.map((opcao) => (
                  <li key={opcao.id}>
                    <button
                      type="button"
                      onClick={() => selecionarProduto(item.chave, opcao)}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-background"
                    >
                      {opcao.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {item.calculando && <p className="text-xs text-muted">Calculando...</p>}
            {item.erroCalculo && <p className="text-xs font-medium text-ink">{item.erroCalculo}</p>}
            {item.calculo && (
              <p className="text-sm text-ink">
                {formatarQuantidadeCalculo(item.calculo)} ·{" "}
                <span className="font-medium">{formatarMoeda(String(item.calculo.valorFinal))}</span>
              </p>
            )}
          </Card>
      ))}
      <button
        type="button"
        onClick={() => setItens((atual) => [...atual, novoItem()])}
        className="col-span-full inline-flex w-fit items-center justify-center gap-2 rounded-full bg-surface px-5 py-2.5 text-sm font-medium text-ink shadow-sm transition hover:opacity-80"
      >
        + Adicionar item
      </button>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-1 min-w-[220px] flex-col gap-1 text-sm text-muted">
            Forma de pagamento
            <select
              value={formaPagamentoId}
              onChange={(evento) => setFormaPagamentoId(evento.target.value)}
              className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
            >
              <option value="">Selecione...</option>
              {formasPagamento.map((forma) => (
                <option key={forma.id} value={forma.id}>
                  {forma.descricao ?? forma.codigo ?? forma.id}
                </option>
              ))}
            </select>
            {formasPagamento.length === 0 && (
              <span className="text-xs text-muted">
                Nenhuma forma de pagamento disponível - verifique a sincronização.
              </span>
            )}
          </label>
          <label className="flex flex-1 min-w-[220px] flex-col gap-1 text-sm text-muted">
            Condição de pagamento
            <select
              value={condicaoPagamentoId}
              onChange={(evento) => setCondicaoPagamentoId(evento.target.value)}
              className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
            >
              <option value="">Selecione...</option>
              {condicoesPagamento.map((condicao) => (
                <option key={condicao.id} value={condicao.id}>
                  {condicao.nome ?? condicao.codigo ?? condicao.id}
                </option>
              ))}
            </select>
            {condicoesPagamento.length === 0 && (
              <span className="text-xs text-muted">
                Nenhuma condição de pagamento disponível - verifique a sincronização.
              </span>
            )}
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Desconto (%)
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={percentualDesconto}
            onChange={(evento) => setPercentualDesconto(evento.target.value)}
            className="w-32 rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          />
        </label>
        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm text-muted">Total estimado</span>
          <span className="text-2xl font-bold text-ink">{formatarMoeda(String(totalComDesconto))}</span>
        </div>
      </Card>

      {erro && <p className="col-span-full text-sm font-medium text-ink">{erro}</p>}

      <div className="col-span-full flex justify-end">
        <button
          type="button"
          disabled={pending || !podeSubmeter()}
          onClick={onSubmit}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
        >
          {pending ? "Enviando..." : "Confirmar pedido"}
        </button>
      </div>
    </div>
  );
}
