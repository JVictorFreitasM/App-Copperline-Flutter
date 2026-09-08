import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { TabelaPrecoResumoDto } from "@/lib/tabelas-preco";
import { formatarDataHora } from "@/lib/formatacao";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { Badge, BadgeAtivoInativo } from "@/components/badge";
import { ListItem } from "@/components/design/list-item";

// Tabelas de preço sincronizadas via Empresarial.svc/BuscarTabelasPreco
// (ver backend/src/sync/strategies/tabela-preco.sync.ts) - leitura aberta
// a qualquer vendedor autenticado, mesmo critério de /produtos. Sem
// paginação aqui (poucas dezenas de tabelas no total, diferente dos itens
// dentro de uma tabela - ver [id]/page.tsx).
export default async function TabelasPrecoPage() {
  await exigirUsuarioAutenticado("/tabelas-preco");

  let tabelas: TabelaPrecoResumoDto[] | null = null;
  let erro: string | null = null;

  try {
    tabelas = await apiFetch<TabelaPrecoResumoDto[]>("/tabelas-preco", { cache: "no-store" });
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Tabelas de preço</h1>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : tabelas && tabelas.length === 0 ? (
        <EstadoVazio mensagem="Nenhuma tabela de preço sincronizada ainda." />
      ) : (
        tabelas && (
          <div className="flex flex-col gap-3">
            {tabelas.map((tabela) => (
              <ListItem
                key={tabela.id}
                href={`/tabelas-preco/${tabela.id}`}
                titulo={`Tabela ${tabela.codigo}`}
                subtitulo={`${tabela.quantidadeItens} item(ns) · sincronizada em ${formatarDataHora(tabela.sincronizadoEm)}`}
                tag={
                  <div className="flex flex-col items-end gap-1">
                    {tabela.padrao && <Badge enfase>Padrão</Badge>}
                    <BadgeAtivoInativo inativo={!tabela.ativa} />
                  </div>
                }
              />
            ))}
          </div>
        )
      )}
    </main>
  );
}
