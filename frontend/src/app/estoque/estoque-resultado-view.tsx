import { Card } from "@/components/design/card";
import { ListItem } from "@/components/design/list-item";
import { formatarQuantidade } from "@/lib/formatacao";
import type { EstoqueConsultaDto } from "@/lib/estoque";

// Bloco visual compartilhado entre a busca pontual (BuscaEstoque, cliente)
// e a tela dedicada de estoque por produto (estoque/[identificador]/page.tsx,
// servidor) - mesmo resultado, duas entradas diferentes (pedido do
// usuário, 2026-09-23: a tela dedicada NÃO reaproveita a tela de busca
// geral/produtos mais pedidos, só o pedaço visual do resultado em si).
export function EstoqueResultadoView({ resultado }: { resultado: EstoqueConsultaDto }) {
  return (
    <div className="flex flex-col gap-3">
      {/* Duas métricas DIFERENTES, lado a lado e rotuladas - nunca
          somadas ou confundidas entre si (ver skill wk-radar-bi-client:
          confirmado via teste real que não batem, por design). */}
      <Card>
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-muted">Estoque físico (soma dos lotes)</p>
            <p className="text-lg font-semibold text-ink">
              {formatarQuantidade(resultado.quantidadeFisicaTotal)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Disponível (líquido de pedido em aberto)</p>
            <p className="text-lg font-semibold text-ink">
              {formatarQuantidade(resultado.quantidadeDisponivel)}
            </p>
          </div>
        </div>
      </Card>

      {resultado.itens.length === 0 && (
        <p className="text-sm text-muted">Sem lote físico em estoque.</p>
      )}

      {resultado.itens.map((item, indice) => (
        <ListItem
          key={indice}
          titulo={item.localNome ?? item.localCodigo ?? "Local não identificado"}
          subtitulo={
            item.lote || item.fabricadoEm
              ? `Lote ${item.lote ?? "—"} · Fabricado em ${item.fabricadoEm ?? "—"}`
              : undefined
          }
          valor={formatarQuantidade(item.quantidade)}
        />
      ))}
      {resultado.atualizadoEm && (
        <p className="text-xs text-muted">
          Disponível atualizado em {new Date(resultado.atualizadoEm).toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}
