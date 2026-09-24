import Link from "next/link";
import type { ReactNode } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import {
  configSituacaoPedido,
  rotuloStatusAprovacaoPedido,
  type EnderecoClientePedidoDto,
  type NotaFiscalResumoPedidoDto,
  type PedidoDetalheDto,
  type PedidoItemDto,
} from "@/lib/pedidos";
import { configStatusNfe } from "@/lib/notas-fiscais";
import { formatarData, formatarDataHora, formatarMoeda, formatarPeso, formatarTelefone } from "@/lib/formatacao";
import { EstadoVazio, ErroConexao } from "@/components/listagem-feedback";
import { Badge } from "@/components/badge";
import { AprovarReprovarTudo } from "./aprovar-reprovar-tudo";
import { ItemAprovacaoBotoes } from "./item-aprovacao-botoes";

// Tela de detalhe do pedido (layout de referencia ref1.jpeg, fornecida
// pelo usuario) - retrofit visual completo (substitui a versao anterior,
// baseada em Card+ListItem) pra seguir o mesmo layout denso em colunas da
// referencia. Varios campos da referencia NAO existem no nosso modelo hoje
// (origem de venda, horario do envio, tabela de precos do pedido, forma/
// condicao de pagamento, preco de tabela e %margem por item) - aparecem
// aqui como "—", nunca inventados; documentados em
// OS-pendentes-claude-code.md, secao "Pendente — Web". Observacoes
// (Pedido.observacoes, 2026-09-21) NAO faz mais parte dessa lista -
// campo real agora, preenchido na criacao (POST /pedidos).
export default async function PedidoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirUsuarioAutenticado("/pedidos");

  const { id } = await params;

  let pedido: PedidoDetalheDto | null = null;
  let naoEncontrado = false;
  let erro: string | null = null;

  try {
    pedido = await apiFetch<PedidoDetalheDto>(`/pedidos/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      naoEncontrado = true;
    } else {
      erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <Link href="/pedidos" className="text-sm font-medium text-muted hover:text-ink">
        « Lista de pedidos
      </Link>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : naoEncontrado ? (
        <EstadoVazio mensagem={`Pedido '${id}' não encontrado.`} />
      ) : (
        pedido && <ConteudoPedido pedido={pedido} />
      )}
    </main>
  );
}

function ConteudoPedido({ pedido }: { pedido: PedidoDetalheDto }) {
  const endereco = pedido.cliente?.enderecos?.[0];
  // Contato ESCOLHIDO na criacao (Pedido.contatoId) tem prioridade - so'
  // cai pro primeiro contato do cliente quando o pedido nao tem um
  // vinculado (ex: pedido sincronizado do Radar, que nunca preenche isso).
  const contato = pedido.contato ?? pedido.cliente?.contatos?.[0] ?? null;
  const vendedorExibido = pedido.vendedorResponsavel ?? pedido.vendedor;
  // Pedido já faturado é decisão encerrada - não faz sentido oferecer
  // aceitar/recusar item (nem em lote) depois disso (pedido do usuário,
  // 2026-09-17).
  const faturado = pedido.situacao === "FATURADO";
  // Pedido FATURADO ou PARCIALMENTE_FATURADO deve ter nota fiscal
  // disponível pra visualização/PDF/impressão (pedido do usuário,
  // 2026-09-23) - pode ter mais de uma (faturamento parcial: fatura o
  // que tem, emite a nota, e emite outra depois pro restante). Mostra a
  // seção mesmo sem nenhuma nota vinculada ainda, pra deixar claro que
  // algo está pendente em vez de simplesmente não aparecer nada.
  const esperaNotaFiscal =
    pedido.situacao === "FATURADO" || pedido.situacao === "PARCIALMENTE_FATURADO";

  return (
    <>
      <div className="flex items-end gap-6 border-b border-line">
        <span className="border-b-2 border-primary pb-3 text-sm font-semibold text-ink">
          PEDIDO Nº: {pedido.numero ?? pedido.id.slice(0, 8)}
        </span>
        <Link
          href={`/pedidos/${pedido.id}/historico`}
          className="pb-3 text-sm font-medium text-muted hover:text-ink"
        >
          HISTÓRICO
        </Link>
      </div>

      {!faturado && <AprovarReprovarTudo pedidoId={pedido.id} />}

      <div className="rounded-card bg-surface p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Coluna 1 - pedido/cliente */}
          <div className="flex flex-col gap-4">
            <Campo label="Tipo de pedido" value="Venda" />
            <div>
              <p className="text-xs text-muted">Cliente</p>
              <p className="text-sm font-semibold text-ink">
                {pedido.cliente?.razaoSocial ?? "Cliente não identificado"}
              </p>
              {pedido.cliente?.nomeFantasia &&
                pedido.cliente.nomeFantasia !== pedido.cliente.razaoSocial && (
                  <p className="text-xs text-muted">{pedido.cliente.nomeFantasia}</p>
                )}
              {pedido.cliente && (
                <p className="text-xs text-muted">
                  {pedido.cliente.cpfCnpj ?? "—"}
                  {pedido.cliente.codigoIntegrador && ` / Cód: ${pedido.cliente.codigoIntegrador}`}
                </p>
              )}
              {endereco && <EnderecoTexto endereco={endereco} />}
            </div>
            <div>
              <p className="text-xs text-muted">Contato</p>
              <p className="text-sm font-medium text-ink">
                {contato?.nome ?? "—"}
                {contato && (
                  <span className="text-muted"> · {formatarTelefone(contato.telefoneDdd, contato.telefoneNumero)}</span>
                )}
              </p>
            </div>
            <div className="flex gap-6">
              <Campo
                label="Nr. do Pedido / Nr. no ERP"
                value={`${pedido.idExternoErp ?? "N/A"} / ${pedido.numero ?? pedido.id.slice(0, 8)}`}
              />
            </div>
            <Campo label="Origem de venda" value="—" />
            <Campo label="Horário do envio" value={formatarDataHora(pedido.horarioEnvio)} />
          </div>

          {/* Coluna 2 - pagamento/vendedor */}
          <div className="flex flex-col gap-4">
            <Campo label="Tabela de preços" value={pedido.codigoTabelaPreco ?? "—"} />
            <div>
              <p className="text-xs text-muted">Pagamento</p>
              {pedido.percentualDescontoSolicitado ? (
                <p className="text-sm text-ink">
                  <span className="font-semibold">{formatarMoeda(pedido.valorTotal)}</span>
                  <span className="text-muted">
                    {" "}
                    ({pedido.percentualDescontoSolicitado}% de desconto solicitado)
                  </span>
                </p>
              ) : (
                <p className="text-sm font-semibold text-ink">{formatarMoeda(pedido.valorTotal)}</p>
              )}
            </div>
            <Campo
              label="Forma de pagamento"
              value={pedido.formaPagamento?.descricao ?? pedido.formaPagamento?.codigo ?? "—"}
            />
            <Campo
              label="Condição de pagamento"
              value={pedido.condicaoPagamento?.nome ?? pedido.condicaoPagamento?.codigo ?? "—"}
            />
            <Campo label="Vendedor" value={vendedorExibido?.nome ?? "—"} />
          </div>

          {/* Coluna 3 - margem/peso */}
          <div className="flex flex-col gap-4">
            <Campo label="Margem" value="—" />
            <Campo label="Peso Bruto Total" value={formatarPeso(pedido.pesoBrutoTotalKg)} />
            <Campo label="Peso Líquido Total" value={formatarPeso(pedido.pesoLiquidoTotalKg)} />
          </div>

          {/* Coluna 4 - status/observações */}
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs text-muted">Status da aprovação</p>
              <select
                disabled
                value={pedido.statusAprovacaoBucket}
                title="Calculado automaticamente - sem edição manual"
                className="mt-1 w-full cursor-not-allowed rounded-full bg-background px-4 py-2 text-sm text-ink opacity-80"
              >
                <option value={pedido.statusAprovacaoBucket}>
                  {rotuloStatusAprovacaoPedido(pedido.statusAprovacaoBucket)}
                </option>
              </select>
            </div>
            <div>
              <p className="text-xs text-muted">Observações</p>
              <textarea
                disabled
                readOnly
                value={pedido.observacoes ?? ""}
                placeholder="Nenhuma observação"
                className="mt-1 w-full cursor-not-allowed rounded-2xl bg-background px-4 py-3 text-sm text-ink opacity-80"
                rows={3}
              />
            </div>
          </div>
        </div>
      </div>

      <TabelaItens pedidoId={pedido.id} itens={pedido.itens} faturado={faturado} />

      {esperaNotaFiscal && <NotasFiscaisSecao notasFiscais={pedido.notasFiscais} />}
    </>
  );
}

function NotasFiscaisSecao({ notasFiscais }: { notasFiscais: NotaFiscalResumoPedidoDto[] }) {
  return (
    <div className="rounded-card bg-surface p-6 shadow-sm">
      <p className="mb-4 text-sm font-semibold text-ink">Notas fiscais</p>
      {notasFiscais.length === 0 ? (
        <p className="text-sm text-muted">
          Nenhuma nota fiscal vinculada a este pedido ainda.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {notasFiscais.map((nota) => {
            const status = configStatusNfe(nota.statusNfe);
            return (
              <div
                key={nota.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-ink">
                    NF-e {nota.numero ?? "—"}
                    {nota.serie && ` · Série ${nota.serie}`}
                  </p>
                  <p className="text-xs text-muted">
                    Emitida em {formatarData(nota.dataEmissao)} ·{" "}
                    {formatarMoeda(nota.valorTotalNotaFiscal)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge enfase={status.enfase}>{status.rotulo}</Badge>
                  {nota.chave ? (
                    <a
                      href={`/api/notas-fiscais/${nota.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Ver PDF
                    </a>
                  ) : (
                    <span className="text-xs text-muted" title="Sem chave de NF-e sincronizada">
                      PDF indisponível
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Campo({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function EnderecoTexto({ endereco }: { endereco: EnderecoClientePedidoDto }) {
  const linha1 = [endereco.nomeEndereco, endereco.numero, endereco.complemento]
    .filter(Boolean)
    .join(", ");
  const linha2 = [endereco.bairro, endereco.cep, endereco.uf].filter(Boolean).join(" - ");
  if (!linha1 && !linha2) return null;
  return (
    <p className="text-xs text-muted">
      {linha1}
      {linha1 && linha2 && <br />}
      {linha2}
    </p>
  );
}

function TabelaItens({
  pedidoId,
  itens,
  faturado,
}: {
  pedidoId: string;
  itens: PedidoItemDto[];
  faturado: boolean;
}) {
  if (itens.length === 0) {
    return <EstadoVazio mensagem="Nenhum item neste pedido." />;
  }

  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-sm">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs font-medium text-muted">
            <th className="px-4 py-3"></th>
            <th className="px-4 py-3">Código</th>
            <th className="px-4 py-3">Qtd</th>
            <th className="px-4 py-3">Produto</th>
            <th className="px-4 py-3 text-right">Valor unitário líquido</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => {
            // Produto.pesoLiquidoKg/pesoBrutoKg e' peso POR METRO pra item
            // METRO (retalho) - quantidadeVenda desse item vem em KM (ver
            // pedido-response.dto.ts), precisa voltar pra metros aqui antes
            // de multiplicar (mesmo criterio de calcularPesoTotal no
            // backend, criar-pedido.service.ts).
            const quantidadeEmMetros =
              item.unidade === "METRO" && item.quantidadeVenda !== null
                ? String(Number(item.quantidadeVenda) * 1000)
                : item.quantidadeVenda;
            const pesoLiquidoItem = calcularPesoItem(item.produto?.pesoLiquidoKg, quantidadeEmMetros);
            const pesoBrutoItem = calcularPesoItem(item.produto?.pesoBrutoKg, quantidadeEmMetros);
            return (
              <tr key={item.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  {!faturado && (
                    <ItemAprovacaoBotoes
                      pedidoId={pedidoId}
                      itemId={item.id}
                      statusAprovacao={item.statusAprovacao}
                    />
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{item.produto?.codigo ?? "—"}</td>
                <td className="px-4 py-3 text-muted">
                  {item.quantidadeVenda === null
                    ? "—"
                    : item.unidade === "METRO"
                      ? `${item.quantidadeVenda} km`
                      : item.quantidadeVenda}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{item.produto?.nome ?? "—"}</p>
                  {(pesoBrutoItem || pesoLiquidoItem) && (
                    <p className="text-xs text-muted">
                      {pesoBrutoItem && `Peso Bruto: ${pesoBrutoItem}`}
                      {pesoBrutoItem && pesoLiquidoItem && " · "}
                      {pesoLiquidoItem && `Peso Líquido: ${pesoLiquidoItem}`}
                    </p>
                  )}
                  {item.observacoes && (
                    <p className="text-xs text-muted">Obs: {item.observacoes}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-ink">{formatarMoeda(item.valorUnitario)}</td>
                <td className="px-4 py-3">
                  <Badge enfase={configSituacaoPedido(item.situacao).enfase}>
                    {configSituacaoPedido(item.situacao).rotulo}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right font-medium text-ink">
                  {formatarMoeda(item.valorTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} />
            <td className="px-4 py-3 text-right text-lg font-bold text-ink">
              {formatarMoeda(somarTotalItens(itens))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function calcularPesoItem(pesoUnitarioKg: string | null | undefined, quantidade: string | null): string | null {
  if (!pesoUnitarioKg || !quantidade) return null;
  const total = Number(pesoUnitarioKg) * Number(quantidade);
  if (Number.isNaN(total)) return null;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(total)} kg`;
}

function somarTotalItens(itens: PedidoItemDto[]): string {
  const total = itens.reduce((acumulado, item) => acumulado + Number(item.valorTotal ?? 0), 0);
  return total.toString();
}
