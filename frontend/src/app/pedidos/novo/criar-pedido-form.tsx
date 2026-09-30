"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContatoClienteDto } from "@/lib/clientes";
import { formatarMoeda, formatarPercentual } from "@/lib/formatacao";
import type { CondicaoPagamentoDto, FormaPagamentoDto } from "@/lib/pagamento";
import type { MeuVendedorDto, VendedorEquipeDto } from "@/lib/vendedores";
import { AdicionarContatoPopup } from "./adicionar-contato-popup";
import { buscarClientes, criarPedido, obterContatosCliente } from "./actions";
import { ItemDetalhePopup } from "./item-detalhe-popup";
import { SelecionarItemPopup } from "./selecionar-item-popup";
import { TabelaPrecoPopup } from "./tabela-preco-popup";
import type { ItemPedidoState, OpcaoBusca } from "./tipos";

// Unificação da tela de criar pedido com o popup de confirmação por item
// (referência do usuário: "tela cadastro de pedidos.jpg" pro layout desta
// tela, "popup selecionar item.jpg"/"img.jpeg" pros popups em cascata) -
// tudo preenchido uma vez só, sem repetir cliente/tabela em cada item.
const DEBOUNCE_MS = 300;
// item.valorUnitarioBruto/quantidade vem em METRO internamente (mesmo
// motivo de item-detalhe-popup.tsx) - preço de tabela do WK Radar é
// sempre por KM, convertido de volta (×1000) só pra EXIBIÇÃO nesta tabela
// (achado do usuário, 2026-09-23).
const METROS_POR_KM = 1000;

export function CriarPedidoForm({
  formasPagamento,
  condicoesPagamento,
  meuVendedor,
  vendedoresEquipe,
  nomeUsuarioLogado,
  modoOrcamento = false,
}: {
  formasPagamento: FormaPagamentoDto[];
  condicoesPagamento: CondicaoPagamentoDto[];
  meuVendedor: MeuVendedorDto;
  vendedoresEquipe: VendedorEquipeDto[];
  nomeUsuarioLogado: string;
  // Épico 4 (config-aba-orcamento.jpg) - "Criar orçamento" na listagem
  // reusa este mesmo formulário, só muda o que é enviado ao confirmar
  // (salvarComoOrcamento) e o texto do botão/título.
  modoOrcamento?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [clienteQuery, setClienteQuery] = useState("");
  const [opcoesCliente, setOpcoesCliente] = useState<OpcaoBusca[]>([]);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [cliente, setCliente] = useState<OpcaoBusca | null>(null);
  const timerCliente = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [contatos, setContatos] = useState<ContatoClienteDto[]>([]);
  const [contatoId, setContatoId] = useState<string | null>(null);
  const [contatoPopupAberto, setContatoPopupAberto] = useState(false);

  const [tabelaPopupAberto, setTabelaPopupAberto] = useState(false);
  const [codigoTabelaPreco, setCodigoTabelaPreco] = useState<string | undefined>(undefined);

  const [itens, setItens] = useState<ItemPedidoState[]>([]);
  const [selecionarItemAberto, setSelecionarItemAberto] = useState(false);
  const [itemPopup, setItemPopup] = useState<{
    produto: OpcaoBusca;
    itemExistente: ItemPedidoState | null;
  } | null>(null);

  const [formaPagamentoId, setFormaPagamentoId] = useState("");
  const [condicaoPagamentoId, setCondicaoPagamentoId] = useState("");
  const [vendedorId, setVendedorId] = useState<string | undefined>(undefined);
  const [observacoesPedido, setObservacoesPedido] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [avisoEnvio, setAvisoEnvio] = useState<string | null>(null);

  // Primeira opção do dropdown é a própria conta (quando ela também é uma
  // vendedora ativa); as demais são os subordinados (decisão confirmada
  // com o usuário). GET /vendedores/equipe já inclui a própria conta na
  // lista - só reordena.
  const opcoesVendedor = meuVendedor.vendedorId
    ? [
        ...vendedoresEquipe.filter((v) => v.id === meuVendedor.vendedorId),
        ...vendedoresEquipe.filter((v) => v.id !== meuVendedor.vendedorId),
      ]
    : vendedoresEquipe;

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

  function selecionarCliente(opcao: OpcaoBusca) {
    setCliente(opcao);
    setClienteQuery(opcao.label);
    setOpcoesCliente([]);
    // Tabela/contato/itens dependem de qual cliente está selecionado -
    // trocar de cliente reseta os três, pra nunca deixar um item calculado
    // com preço da tabela do cliente ANTERIOR.
    setContatoId(null);
    setCodigoTabelaPreco(undefined);
    setItens([]);
    setContatos([]);
    obterContatosCliente(opcao.id).then(setContatos);
    setTabelaPopupAberto(true);
  }

  const total = itens.reduce((soma, item) => soma + item.valorFinal, 0);

  function podeSubmeter(): boolean {
    return Boolean(cliente && formaPagamentoId && condicaoPagamentoId && itens.length > 0);
  }

  function onSubmit() {
    setErro(null);
    if (!cliente) return setErro("Selecione um cliente.");
    if (!formaPagamentoId) return setErro("Selecione a forma de pagamento.");
    if (!condicaoPagamentoId) return setErro("Selecione a condição de pagamento.");
    if (itens.length === 0) return setErro("Adicione pelo menos um item.");

    startTransition(async () => {
      const resultado = await criarPedido({
        clienteId: cliente.id,
        formaPagamentoId,
        condicaoPagamentoId,
        codigoTabelaPreco,
        contatoId: contatoId ?? undefined,
        vendedorId,
        salvarComoOrcamento: modoOrcamento || undefined,
        observacoes: observacoesPedido.trim() || undefined,
        itens: itens.map((item) => ({
          produtoId: item.produto.id,
          metrosDesejados: item.metrosDesejados * 1000,
          percentualDesconto: item.percentualDesconto,
          observacoes: item.observacoes || undefined,
        })),
      });

      if (resultado.status === "sucesso") {
        // Pedido do usuário (2026-09-30) - antes navegava direto, sem
        // diferenciar ENVIADO de AGUARDANDO_APROVACAO (situacaoPedido já
        // vinha no resultado, mas nunca era lido). Mesmo critério do
        // mobile: mostra o aviso por um instante antes de ir pro detalhe.
        if (resultado.situacaoPedido === "AGUARDANDO_APROVACAO") {
          setAvisoEnvio("Pedido enviado para aprovação do desconto.");
        } else if (resultado.situacaoPedido === "ORCAMENTO") {
          setAvisoEnvio("Orçamento salvo.");
        }
        setTimeout(() => router.push(`/pedidos/${resultado.pedidoId}`), 1200);
        return;
      }
      setErro(resultado.mensagem ?? "Erro desconhecido ao criar o pedido.");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-card bg-surface p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Coluna 1 - pedido/cliente/contato */}
          <div className="flex flex-col gap-4">
            <Campo label="Tipo de pedido" value="Venda" />
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
            {!cliente &&
              (buscandoCliente ? (
                <p className="text-xs text-muted">Buscando...</p>
              ) : (
                opcoesCliente.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {opcoesCliente.map((opcao) => (
                      <li key={opcao.id}>
                        <button
                          type="button"
                          onClick={() => selecionarCliente(opcao)}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-background"
                        >
                          {opcao.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ))}
            {cliente && (
              <label className="flex flex-col gap-1 text-sm text-muted">
                Contato
                <select
                  value={contatoId ?? ""}
                  onChange={(evento) => {
                    if (evento.target.value === "__novo__") {
                      setContatoPopupAberto(true);
                      return;
                    }
                    setContatoId(evento.target.value || null);
                  }}
                  className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                >
                  <option value="">Selecionar contato</option>
                  {contatos.map((contato) => (
                    <option key={contato.id} value={contato.id}>
                      {contato.nome ?? "—"}
                    </option>
                  ))}
                  <option value="__novo__">+ Adicionar contato...</option>
                </select>
              </label>
            )}
          </div>

          {/* Coluna 2 - tabela/pagamento/vendedor */}
          <div className="flex flex-col gap-4">
            <Campo label="Tabela de preços" value={codigoTabelaPreco ?? "—"} />
            <Campo label="Pagamento" value={formatarMoeda(String(total))} />
            <label className="flex flex-col gap-1 text-sm text-muted">
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
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
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
            </label>
            {opcoesVendedor.length > 0 ? (
              <label className="flex flex-col gap-1 text-sm text-muted">
                Vendedor
                <select
                  value={vendedorId ?? meuVendedor.vendedorId ?? ""}
                  onChange={(evento) => setVendedorId(evento.target.value)}
                  className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                >
                  {opcoesVendedor.map((vendedor) => (
                    <option key={vendedor.id} value={vendedor.id}>
                      {vendedor.nome ?? "—"}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <Campo label="Vendedor" value={nomeUsuarioLogado} />
            )}
          </div>

          {/* Coluna 3 - margem */}
          <div className="flex flex-col gap-4">
            <Campo label="Margem" value="—" title="Fórmula de margem ainda não confirmada" />
          </div>

          {/* Coluna 4 - observações */}
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm text-muted">
              Observações
              <textarea
                value={observacoesPedido}
                onChange={(evento) => setObservacoesPedido(evento.target.value)}
                placeholder="Nenhuma observação"
                rows={3}
                className="rounded-2xl bg-background px-4 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-card bg-surface shadow-sm">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-medium text-muted">
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Qtd</th>
              <th className="px-4 py-3 text-right">Preço tabela</th>
              <th className="px-4 py-3 text-right">Desconto no item</th>
              <th className="px-4 py-3 text-right">Valor unitário líquido</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted">
                  Nenhum item adicionado ao pedido.
                </td>
              </tr>
            ) : (
              itens.map((item) => (
                <tr key={item.chave} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setItemPopup({ produto: item.produto, itemExistente: item })}
                      className="text-left font-medium text-ink hover:underline"
                    >
                      {item.produto.label}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {item.unidade === "METRO"
                      ? `${item.metrosDesejados} km`
                      : `${item.quantidade} ${item.unidade}`}
                  </td>
                  <td className="px-4 py-3 text-right text-ink">
                    {formatarMoeda(String(item.valorUnitarioBruto * METROS_POR_KM))}
                  </td>
                  <td className="px-4 py-3 text-right text-ink">
                    {formatarPercentual(item.percentualDesconto)}
                  </td>
                  <td className="px-4 py-3 text-right text-ink">
                    {formatarMoeda(
                      String(
                        item.unidade === "METRO" && item.metrosDesejados > 0
                          ? item.valorFinal / item.metrosDesejados
                          : item.valorFinal / item.quantidade,
                      ),
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-ink">
                    {formatarMoeda(String(item.valorFinal))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setItens((atual) => atual.filter((i) => i.chave !== item.chave))}
                      className="text-xs text-muted hover:text-ink"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {itens.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={5} />
                <td className="px-4 py-3 text-right text-lg font-bold text-ink">
                  {formatarMoeda(String(total))}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <button
        type="button"
        disabled={!cliente}
        onClick={() => setSelecionarItemAberto(true)}
        className="inline-flex w-fit items-center justify-center gap-2 rounded-full bg-solid px-5 py-2.5 text-sm font-medium text-on-solid transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
      >
        + Adicionar item
      </button>

      {erro && <p className="text-sm font-medium text-ink">{erro}</p>}
      {avisoEnvio && <p className="text-sm font-medium text-ink">{avisoEnvio}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={pending || avisoEnvio !== null || !podeSubmeter()}
          onClick={onSubmit}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-solid px-5 py-2.5 text-sm font-medium text-on-solid transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
        >
          {pending ? "Enviando..." : modoOrcamento ? "Salvar orçamento" : "Confirmar pedido"}
        </button>
      </div>

      <TabelaPrecoPopup
        open={tabelaPopupAberto}
        clienteId={cliente?.id ?? null}
        onFechar={() => setTabelaPopupAberto(false)}
        onSelecionar={setCodigoTabelaPreco}
      />

      <SelecionarItemPopup
        open={selecionarItemAberto}
        onCancelar={() => setSelecionarItemAberto(false)}
        onSelecionarProduto={(produto) => {
          setSelecionarItemAberto(false);
          // Produto ja adicionado ao pedido - abre pra EDITAR o item
          // existente em vez de criar uma linha duplicada do mesmo
          // produto (pedido explicito do usuario, 2026-09-23). Mesmo
          // comportamento de clicar no nome do produto na tabela abaixo.
          const itemExistente = itens.find((i) => i.produto.id === produto.id) ?? null;
          setItemPopup({ produto, itemExistente });
        }}
      />

      <ItemDetalhePopup
        open={itemPopup !== null}
        produto={itemPopup?.produto ?? null}
        codigoTabelaPreco={codigoTabelaPreco}
        itemExistente={itemPopup?.itemExistente ?? null}
        onCancelar={() => setItemPopup(null)}
        onConfirmar={(item) => {
          setItens((atual) => {
            const existe = atual.some((i) => i.chave === item.chave);
            return existe ? atual.map((i) => (i.chave === item.chave ? item : i)) : [...atual, item];
          });
          setItemPopup(null);
        }}
      />

      <AdicionarContatoPopup
        open={contatoPopupAberto}
        clienteId={cliente?.id ?? null}
        onCancelar={() => setContatoPopupAberto(false)}
        onCriado={(contato) => {
          setContatos((atual) => [...atual, contato]);
          setContatoId(contato.id);
          setContatoPopupAberto(false);
        }}
      />
    </div>
  );
}

function Campo({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div title={title}>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
