import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { AgendamentoVisitaEquipeDto } from "@/lib/agendamentos";
import type { VendedorEquipeDto } from "@/lib/vendedores";
import { formatarDataHora } from "@/lib/formatacao";
import { Card } from "@/components/design/card";
import { PrimaryButton } from "@/components/design/button";
import { EstadoVazio, ErroConexao } from "@/components/listagem-feedback";

// OS-pendentes-claude-code.md - gap identificado: so existia "minha
// agenda" (self-scoped), supervisor/admin nao tinha onde ver agendamento
// da equipe pelo painel. GET /agendamentos-visita/equipe e' novo (esta OS,
// ver AgendamentosVisitaService.listarEquipe) - mesmo padrao de
// admin/visitas/page.tsx: sessao SSO normal (nao ApiKeyGuard), 403 vira
// "sem permissao" em vez de notFound() (qualquer supervisor/gerente
// legitimo deve chegar ate aqui).
export default async function AdminAgendamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ vendedorId?: string; dataInicial?: string; dataFinal?: string }>;
}) {
  await exigirUsuarioAutenticado("/admin/agendamentos");

  const { vendedorId, dataInicial, dataFinal } = await searchParams;

  let agendamentos: AgendamentoVisitaEquipeDto[] = [];
  let equipe: VendedorEquipeDto[] = [];
  let semPermissao = false;
  let erro: string | null = null;

  try {
    const query = new URLSearchParams({
      ...(vendedorId && { vendedorId }),
      ...(dataInicial && { dataInicial }),
      ...(dataFinal && { dataFinal }),
    });
    [agendamentos, equipe] = await Promise.all([
      apiFetch<AgendamentoVisitaEquipeDto[]>(`/agendamentos-visita/equipe?${query}`, {
        cache: "no-store",
      }),
      apiFetch<VendedorEquipeDto[]>("/vendedores/equipe", { cache: "no-store" }),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      semPermissao = true;
    } else {
      erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Agendamentos de visita da equipe</h1>

      {semPermissao ? (
        <Card>
          <p className="text-sm text-muted">
            Você não tem papel de supervisão (supervisor ou gerente) - nenhum agendamento de
            equipe para ver aqui.
          </p>
        </Card>
      ) : erro ? (
        <ErroConexao mensagem={erro} />
      ) : (
        <>
          <Card>
            <form
              method="get"
              action="/admin/agendamentos"
              className="flex flex-wrap items-end gap-3"
            >
              <label className="flex flex-col gap-1 text-sm text-muted">
                Vendedor
                <select
                  name="vendedorId"
                  defaultValue={vendedorId ?? ""}
                  className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                >
                  <option value="">Toda a equipe</option>
                  {equipe.map((vendedor) => (
                    <option key={vendedor.id} value={vendedor.id}>
                      {vendedor.nome ?? vendedor.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-muted">
                De
                <input
                  type="date"
                  name="dataInicial"
                  defaultValue={dataInicial}
                  className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-muted">
                Até
                <input
                  type="date"
                  name="dataFinal"
                  defaultValue={dataFinal}
                  className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                />
              </label>
              <PrimaryButton type="submit">Filtrar</PrimaryButton>
            </form>
          </Card>

          {agendamentos.length === 0 ? (
            <EstadoVazio mensagem="Nenhum agendamento encontrado com esse filtro." />
          ) : (
            <div className="flex flex-col gap-3">
              {agendamentos.map((agendamento) => (
                <Card key={agendamento.id}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="text-sm text-ink">
                      <span className="font-medium">{agendamento.vendedor.nome ?? "—"}</span> ·
                      Cliente {agendamento.cliente.razaoSocial ?? "não identificado"}
                    </p>
                    <span className="text-sm text-ink">
                      {formatarDataHora(agendamento.dataHoraPrevista)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
