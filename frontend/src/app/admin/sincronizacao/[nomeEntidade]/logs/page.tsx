import { notFound } from "next/navigation";
import Link from "next/link";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { adminApiFetch } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import type { PaginatedResult } from "@/lib/pagination";
import { configStatusSyncLog, rotuloEntidade, type SyncLogResumoDto } from "@/lib/admin-sync";
import { Card } from "@/components/design/card";
import { Badge } from "@/components/badge";
import { Paginacao } from "@/components/paginacao";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";

const LIMITE_POR_PAGINA = 20;

// Drill-down de logs por entidade (OS-WEB-18) - mostra os avisos de
// truncamento "de forma legível" (critério de aceite da OS-BACKEND-16),
// nunca o Json cru. Mesmo controle de acesso da tela principal (ver
// admin/sincronizacao/page.tsx) - role:'admin', notFound() pros demais.
export default async function LogsSincronizacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ nomeEntidade: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const usuario = await exigirUsuarioAutenticado("/admin/sincronizacao");
  if (usuario.role !== "admin") {
    notFound();
  }

  const { nomeEntidade } = await params;
  const { page } = await searchParams;
  const paginaParam = Number(page);
  const pagina = Number.isInteger(paginaParam) && paginaParam > 0 ? paginaParam : 1;

  let resultado: PaginatedResult<SyncLogResumoDto> | null = null;
  let erro: string | null = null;

  try {
    resultado = await adminApiFetch<PaginatedResult<SyncLogResumoDto>>(
      `/admin/sync/${encodeURIComponent(nomeEntidade)}/logs?page=${pagina}&limit=${LIMITE_POR_PAGINA}`,
      { cache: "no-store" },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <Link
        href="/admin/sincronizacao"
        className="text-sm font-medium text-primary hover:underline"
      >
        ← Central de sincronização
      </Link>
      <h1 className="text-2xl font-bold text-ink">
        Logs de sincronização — {rotuloEntidade(nomeEntidade)}
      </h1>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : resultado && resultado.data.length === 0 ? (
        <EstadoVazio mensagem="Nenhum log de sincronização encontrado para essa entidade." />
      ) : (
        resultado && (
          <>
            <div className="flex flex-col gap-3">
              {resultado.data.map((log) => {
                const status = configStatusSyncLog(log.status);
                return (
                  <Card key={log.id}>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-ink">
                          Iniciado em {new Date(log.iniciadoEm).toLocaleString("pt-BR")}
                        </p>
                        <p className="text-xs text-muted">
                          {log.finalizadoEm
                            ? `Finalizado em ${new Date(log.finalizadoEm).toLocaleString("pt-BR")} · ${Math.round(
                                (log.duracaoMs ?? 0) / 1000,
                              )}s`
                            : "Ainda em andamento"}
                        </p>
                      </div>
                      <Badge enfase={status.enfase}>{status.rotulo}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      {log.registrosProcessados} processado(s), {log.registrosComErro} com erro
                    </p>
                    {log.avisos.length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-xs text-muted">
                        {log.avisos.map((aviso, indice) => (
                          <li key={indice}>{aviso}</li>
                        ))}
                      </ul>
                    )}
                    {log.erro && (
                      <p className="mt-2 text-xs text-muted">
                        Erro: {Object.values(log.erro).join(" · ")}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
            <Paginacao
              rota={`/admin/sincronizacao/${nomeEntidade}/logs`}
              pagina={resultado.meta.page}
              totalPaginas={resultado.meta.totalPages}
            />
          </>
        )
      )}
    </main>
  );
}
