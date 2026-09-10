import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { ConfiguracaoTabelaPrecoDto, TabelaPrecoResumoDto } from "@/lib/tabelas-preco";
import { formatarDataHora } from "@/lib/formatacao";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { Badge, BadgeAtivoInativo } from "@/components/badge";
import { Card } from "@/components/design/card";
import { ListItem } from "@/components/design/list-item";
import { SelecionarTabelaForm } from "./selecionar-tabela-form";

// Tabelas de preço sincronizadas via Empresarial.svc/BuscarTabelasPreco
// (ver backend/src/sync/strategies/tabela-preco.sync.ts) - leitura aberta
// a qualquer vendedor autenticado, mesmo critério de /produtos. Sem
// paginação aqui (poucas dezenas de tabelas no total, diferente dos itens
// dentro de uma tabela - ver [id]/page.tsx). A SELEÇÃO de qual código
// sincronizar (pedido do usuário: "pegue apenas a tabela 110") fica aqui
// no topo, admin-only - acontece ANTES do sync existir, por isso não é
// uma escolha entre tabelas já listadas abaixo.
export default async function TabelasPrecoPage() {
  const usuario = await exigirUsuarioAutenticado("/tabelas-preco");

  let tabelas: TabelaPrecoResumoDto[] | null = null;
  let erro: string | null = null;
  let configuracao: ConfiguracaoTabelaPrecoDto | null = null;

  try {
    [tabelas, configuracao] = await Promise.all([
      apiFetch<TabelaPrecoResumoDto[]>("/tabelas-preco", { cache: "no-store" }),
      usuario.role === "admin"
        ? apiFetch<ConfiguracaoTabelaPrecoDto>("/admin/tabelas-preco/configuracao", {
            cache: "no-store",
          })
        : Promise.resolve(null),
    ]);
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Tabelas de preço</h1>

      {usuario.role === "admin" && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ink">Tabela sincronizada</h2>
          <p className="text-xs text-muted">
            Só o código selecionado aqui é sincronizado com o ERP - as demais tabelas nunca são
            buscadas automaticamente.
          </p>
          <SelecionarTabelaForm codigoAtual={configuracao?.codigoSelecionado ?? null} />
        </Card>
      )}

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
                    {configuracao?.codigoSelecionado === tabela.codigo && <Badge enfase>Selecionada</Badge>}
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
