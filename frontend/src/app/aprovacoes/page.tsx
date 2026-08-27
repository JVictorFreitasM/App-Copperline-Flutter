import { exigirUsuarioAutenticado } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";
import type { SolicitacaoDescontoResumoDto } from "@/lib/solicitacoes-desconto";
import { rotuloPapel } from "@/lib/vendedores";
import { formatarData, formatarMoeda } from "@/lib/formatacao";
import { Card } from "@/components/design/card";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { AprovarRejeitarForm } from "./aprovar-rejeitar-form";

// Aprovação de desconto (OS-WEB-21) - consome GET/POST
// solicitacoes-desconto/* (o GET, escopado por equipe, foi adicionado
// nesta OS - a OS-BACKEND-22 só tinha aprovar/rejeitar, sem lista). Rota
// protegida só por sessão SSO normal (não ApiKeyGuard, diferente das telas
// /admin/*) - "visível só pra quem tem papel adequado" é decidido pelo
// PRÓPRIO backend: SUPERVISOR/GERENTE/admin recebem a lista (já filtrada
// pela equipe, ver VendedorEscopoService), um VENDEDOR comum recebe 403,
// tratado abaixo como uma mensagem "sem permissão" em vez de erro de
// conexão. Sem gate de `role` aqui como nas páginas /admin/* porque
// 'supervisor'/'gerente' não são papéis do IdP (role de sistema), são
// PapelVendedor - o backend é quem sabe resolver isso.
export default async function AprovacoesPage() {
  await exigirUsuarioAutenticado("/aprovacoes");

  let solicitacoes: SolicitacaoDescontoResumoDto[] | null = null;
  let semPermissao = false;
  let erro: string | null = null;

  try {
    solicitacoes = await apiFetch<SolicitacaoDescontoResumoDto[]>("/solicitacoes-desconto", {
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      semPermissao = true;
    } else {
      erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Aprovação de descontos</h1>

      {semPermissao ? (
        <Card>
          <p className="text-sm text-muted">
            Você não tem papel de aprovação (supervisor ou gerente) - nenhuma solicitação de
            equipe para mostrar aqui.
          </p>
        </Card>
      ) : erro ? (
        <ErroConexao mensagem={erro} />
      ) : solicitacoes && solicitacoes.length === 0 ? (
        <EstadoVazio mensagem="Nenhuma solicitação de desconto pendente na sua equipe." />
      ) : (
        solicitacoes && (
          <div className="flex flex-col gap-3">
            {solicitacoes.map((solicitacao) => (
              <Card key={solicitacao.id}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {solicitacao.vendedorSolicitante.nome ?? "Vendedor não identificado"}{" "}
                      solicitou {solicitacao.percentualSolicitado}% de desconto
                    </p>
                    <p className="text-xs text-muted">
                      {solicitacao.pedido?.cliente?.razaoSocial &&
                        `Cliente ${solicitacao.pedido.cliente.razaoSocial} · `}
                      {solicitacao.pedido?.valorTotal &&
                        `${formatarMoeda(solicitacao.pedido.valorTotal)} · `}
                      {formatarData(solicitacao.criadoEm)} · exige papel{" "}
                      {rotuloPapel(solicitacao.papelExigido)}
                    </p>
                  </div>
                  <AprovarRejeitarForm solicitacaoId={solicitacao.id} />
                </div>
              </Card>
            ))}
          </div>
        )
      )}
    </main>
  );
}
