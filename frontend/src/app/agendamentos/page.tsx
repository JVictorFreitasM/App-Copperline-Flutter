import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { AgendamentoVisitaDto } from "@/lib/agendamentos";
import type { ClienteResumoDto } from "@/lib/clientes";
import { formatarDataHora } from "@/lib/formatacao";
import { Card } from "@/components/design/card";
import { EstadoVazio, ErroConexao } from "@/components/listagem-feedback";
import { CriarAgendamentoForm } from "./criar-agendamento-form";

// OS-pendentes-claude-code.md - GET/POST /agendamentos-visita ja existiam
// (OS-novas-implementacoes.md Bloco 5), so pro mobile ("minha agenda").
// clienteId cru no DTO (sem nome resolvido, diferente de VisitaEquipeDto) -
// resolvido aqui com uma busca por id em paralelo, volume sempre pequeno
// (mesmo criterio de "sem paginacao" do proprio backend).
export default async function AgendamentosPage() {
  await exigirUsuarioAutenticado("/agendamentos");

  let agendamentos: AgendamentoVisitaDto[] = [];
  let erro: string | null = null;
  const nomesPorCliente = new Map<string, string>();

  try {
    agendamentos = await apiFetch<AgendamentoVisitaDto[]>("/agendamentos-visita", {
      cache: "no-store",
    });
    const idsUnicos = [...new Set(agendamentos.map((a) => a.clienteId))];
    const clientes = await Promise.all(
      idsUnicos.map((id) =>
        apiFetch<ClienteResumoDto>(`/clientes/${encodeURIComponent(id)}`, {
          cache: "no-store",
        }).catch(() => null),
      ),
    );
    clientes.forEach((cliente, indice) => {
      if (cliente) {
        nomesPorCliente.set(idsUnicos[indice], cliente.razaoSocial ?? cliente.nomeFantasia ?? "—");
      }
    });
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  const agora = new Date();
  const futuros = agendamentos.filter((a) => new Date(a.dataHoraPrevista) >= agora);
  const passados = agendamentos.filter((a) => new Date(a.dataHoraPrevista) < agora);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Minha agenda de visitas</h1>

      <Card>
        <CriarAgendamentoForm />
      </Card>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink">Próximos agendamentos</h2>
            {futuros.length === 0 ? (
              <EstadoVazio mensagem="Nenhum agendamento futuro." />
            ) : (
              <div className="flex flex-col gap-3">
                {futuros.map((agendamento) => (
                  <Card key={agendamento.id}>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <Link
                        href={`/clientes/${agendamento.clienteId}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {nomesPorCliente.get(agendamento.clienteId) ?? agendamento.clienteId}
                      </Link>
                      <span className="text-sm text-ink">
                        {formatarDataHora(agendamento.dataHoraPrevista)}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {passados.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-ink">Passados ({passados.length})</h2>
              <div className="flex flex-col gap-3">
                {passados.map((agendamento) => (
                  <Card key={agendamento.id} className="opacity-70">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <Link
                        href={`/clientes/${agendamento.clienteId}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {nomesPorCliente.get(agendamento.clienteId) ?? agendamento.clienteId}
                      </Link>
                      <span className="text-sm text-muted">
                        {formatarDataHora(agendamento.dataHoraPrevista)}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
