"use client";

import { useEffect, useState } from "react";
import { Modal, ModalFooter } from "@/components/design/modal";
import { formatarMoeda, formatarPercentual } from "@/lib/formatacao";
import { calcularItem } from "./actions";
import type { ItemPedidoState, OpcaoBusca } from "./tipos";

const METROS_POR_KM = 1000;

// Popup de detalhe/confirmação de item (referência do usuário, img.jpeg) -
// abre ao escolher um produto no SelecionarItemPopup. Calcula em tempo
// real via POST /produtos/:id/calcular (mesmo endpoint já usado no resto
// da tela), agora com codigoTabela/percentualDesconto encaminhados.
export function ItemDetalhePopup({
  open,
  produto,
  codigoTabelaPreco,
  itemExistente,
  onCancelar,
  onConfirmar,
}: {
  open: boolean;
  produto: OpcaoBusca | null;
  codigoTabelaPreco: string | undefined;
  itemExistente: ItemPedidoState | null;
  onCancelar: () => void;
  onConfirmar: (item: ItemPedidoState) => void;
}) {
  const [km, setKm] = useState("");
  const [percentualDesconto, setPercentualDesconto] = useState("0");
  const [observacoes, setObservacoes] = useState("");
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [calculo, setCalculo] = useState<{
    quantidade: number;
    unidade: string;
    valorUnitario: number;
    valorFinal: number;
  } | null>(null);

  // Reabre pré-preenchido quando é edição de um item já adicionado, ou
  // limpo quando é um produto novo - roda a cada abertura (open muda de
  // false pra true), não a cada tecla digitada.
  useEffect(() => {
    if (!open) return;
    if (itemExistente) {
      setKm(String(itemExistente.metrosDesejados));
      setPercentualDesconto(String(itemExistente.percentualDesconto));
      setObservacoes(itemExistente.observacoes);
      setCalculo({
        quantidade: itemExistente.quantidade,
        unidade: itemExistente.unidade,
        valorUnitario: itemExistente.valorUnitarioBruto,
        valorFinal: itemExistente.valorFinal,
      });
    } else {
      setKm("");
      setPercentualDesconto("0");
      setObservacoes("");
      setCalculo(null);
    }
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, produto?.id]);

  async function recalcular(kmValor: string, descontoValor: string) {
    setCalculo(null);
    setErro(null);
    const kmNumero = Number(kmValor);
    const desconto = Number(descontoValor) || 0;
    if (!produto || !kmValor || Number.isNaN(kmNumero) || kmNumero <= 0) return;

    setCalculando(true);
    const resultado = await calcularItem(produto.id, kmNumero * METROS_POR_KM, {
      codigoTabela: codigoTabelaPreco,
      percentualDesconto: desconto,
    });
    setCalculando(false);
    if (resultado.status === "sucesso") {
      setCalculo({
        quantidade: resultado.resultado.quantidade,
        unidade: resultado.resultado.unidade,
        valorUnitario: resultado.resultado.valorUnitario,
        valorFinal: resultado.resultado.valorFinal,
      });
    } else {
      setErro(resultado.mensagem);
    }
  }

  if (!produto) return null;

  const valorBrutoTotal = calculo ? calculo.valorUnitario * calculo.quantidade : null;
  const descontoValor = calculo && valorBrutoTotal !== null ? valorBrutoTotal - calculo.valorFinal : null;
  const descontoPercentualEfetivo =
    calculo && valorBrutoTotal ? (descontoValor! / valorBrutoTotal) * 100 : 0;

  return (
    <Modal open={open} onClose={onCancelar} title={produto.label} largura="max-w-2xl">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Quilômetros desejados
            <input
              type="number"
              step="0.001"
              min="0"
              value={km}
              onChange={(evento) => {
                setKm(evento.target.value);
                void recalcular(evento.target.value, percentualDesconto);
              }}
              className="w-40 rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-muted">
            Desconto no item (%)
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={percentualDesconto}
              onChange={(evento) => {
                setPercentualDesconto(evento.target.value);
                void recalcular(km, evento.target.value);
              }}
              className="w-32 rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-muted">
            Observação do item
            <textarea
              value={observacoes}
              onChange={(evento) => setObservacoes(evento.target.value)}
              rows={2}
              placeholder="Opcional"
              className="rounded-2xl bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
            />
          </label>

          {calculando && <p className="text-xs text-muted">Calculando...</p>}
          {erro && <p className="text-xs font-medium text-ink">{erro}</p>}

          {calculo && (
            <div className="grid grid-cols-2 gap-4">
              {/* calculo.valorUnitario/quantidade vem em METRO internamente
                  (ver ProdutoCalculoService.resolverPrecoVenda) - preço de
                  tabela real do WK Radar é sempre por KM, então exibimos
                  convertido de volta (×1000), nunca o valor cru por metro
                  (achado do usuário, 2026-09-23: mesmo bug do preço do
                  produto, aqui no popup de criação de pedido). Só a
                  EXIBIÇÃO muda - o que é persistido/enviado ao ERP continua
                  em metro, sem tocar nisso aqui. */}
              <Campo
                label="Preço"
                value={formatarMoeda(String(calculo.valorUnitario * METROS_POR_KM))}
              />
              <Campo
                label="Valor unitário líquido"
                value={formatarMoeda(
                  String(
                    calculo.unidade === "METRO" && Number(km) > 0
                      ? calculo.valorFinal / Number(km)
                      : calculo.valorFinal / calculo.quantidade,
                  ),
                )}
              />
              <Campo label="Total" value={formatarMoeda(String(calculo.valorFinal))} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-card bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Resumo do pedido
          </p>
          <ResumoLinha label="De" value={valorBrutoTotal !== null ? formatarMoeda(String(valorBrutoTotal)) : "—"} riscado />
          <ResumoLinha label="Por" value={calculo ? formatarMoeda(String(calculo.valorFinal)) : "—"} />
          <ResumoLinha
            label="Desconto no valor líquido"
            value={
              descontoValor !== null
                ? `(${formatarMoeda(String(descontoValor))}) ${formatarPercentual(descontoPercentualEfetivo)}`
                : "—"
            }
          />
        </div>
      </div>

      <div className="mt-6">
        <ModalFooter
          onCancelar={onCancelar}
          confirmarDesabilitado={!calculo}
          onConfirmar={() => {
            if (!calculo) return;
            onConfirmar({
              chave: itemExistente?.chave ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              produto,
              metrosDesejados: Number(km),
              percentualDesconto: Number(percentualDesconto) || 0,
              quantidade: calculo.quantidade,
              unidade: calculo.unidade,
              valorUnitarioBruto: calculo.valorUnitario,
              valorFinal: calculo.valorFinal,
              observacoes: observacoes.trim(),
            });
          }}
        />
      </div>
    </Modal>
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

function ResumoLinha({ label, value, riscado = false }: { label: string; value: string; riscado?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className={`font-medium text-ink ${riscado ? "line-through text-muted" : ""}`}>{value}</span>
    </div>
  );
}
