import { apiFetch, ApiError } from "@/lib/api";
import { formatarMoeda } from "@/lib/formatacao";
import { Card } from "@/components/design/card";
import { EstadoVazio } from "@/components/listagem-feedback";

interface ProdutoPrecoPorTabelaDto {
  codigo: string;
  preco: string | null;
}

// Comparativo de preço por tabela (OS-novas-implementacoes.md Bloco 1) -
// GET /produtos/:id/precos, sem clienteId (compara contra toda tabela
// ativa - a variante escopada por cliente fica pra quando existir um
// fluxo de pedido no painel web que já tenha um cliente em contexto).
// Server Component próprio (não bloqueia o resto da página se essa
// chamada falhar) - erro aqui vira "indisponível", não derruba a tela de
// produto inteira.
export async function PrecosPorTabela({ produtoId }: { produtoId: string }) {
  let tabelas: ProdutoPrecoPorTabelaDto[] = [];
  let indisponivel = false;

  try {
    const resposta = await apiFetch<{ tabelas: ProdutoPrecoPorTabelaDto[] }>(
      `/produtos/${encodeURIComponent(produtoId)}/precos`,
      { cache: "no-store" },
    );
    tabelas = resposta.tabelas;
  } catch {
    indisponivel = true;
  }

  if (indisponivel) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-ink">Preço por tabela</h2>
      {tabelas.length === 0 ? (
        <EstadoVazio mensagem="Nenhuma tabela de preço ativa sincronizada ainda." />
      ) : (
        <Card className="flex flex-col divide-y divide-line text-sm text-ink">
          {tabelas.map((tabela) => (
            <div key={tabela.codigo} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
              <span className="text-muted">Tabela {tabela.codigo}</span>
              <span className="font-medium">
                {tabela.preco ? formatarMoeda(tabela.preco) : "—"}
              </span>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
