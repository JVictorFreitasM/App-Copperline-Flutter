import { notFound } from "next/navigation";
import Link from "next/link";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { adminApiFetch } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import type { PaginatedResult } from "@/lib/pagination";
import {
  configStatusSyncLog,
  ENTIDADES_SEM_CURSOR_INCREMENTAL,
  rotuloEntidade,
  rotuloTipoCadencia,
  type ConfiguracaoSyncDto,
  type RegistrosIncompletosDto,
  type SyncLogResumoDto,
} from "@/lib/admin-sync";
import { Card } from "@/components/design/card";
import { Badge } from "@/components/badge";
import { ErroConexao } from "@/components/listagem-feedback";
import { CadenciaForm } from "./cadencia-form";
import { RodarAgoraForm } from "./rodar-agora-form";

function formatarData(iso: string | null): string {
  if (!iso) return "Nunca sincronizado";
  return new Date(iso).toLocaleString("pt-BR");
}

// Central de sincronização (OS-WEB-18) - consome os endpoints
// administrativos da OS-BACKEND-15/16 (admin/sync/*), protegidos só por
// ApiKeyGuard (não por sessão SSO, ver skill idp-client) - a chave fica só
// no servidor Next.js (lib/admin-api.ts), nunca chega ao navegador. Como o
// backend não distingue QUEM está por trás da chamada (só que a chave está
// certa), a página faz seu próprio controle de acesso por role - só
// role:'admin' passa, mesmo critério já usado em
// backend/src/vendedores/vendedor-escopo.service.ts. notFound() em vez de
// uma tela "acesso negado" (mesmo raciocínio do padrão IDOR do backend:
// 404, não 403 - não confirma pra quem não deveria que a rota existe).
export default async function SincronizacaoPage() {
  const usuario = await exigirUsuarioAutenticado("/admin/sincronizacao");
  if (usuario.role !== "admin") {
    notFound();
  }

  let configuracoes: ConfiguracaoSyncDto[] = [];
  let registrosIncompletos: RegistrosIncompletosDto | null = null;
  const ultimosLogs = new Map<string, SyncLogResumoDto | undefined>();
  let erroCarregamento: string | null = null;

  try {
    const [configs, registros] = await Promise.all([
      adminApiFetch<ConfiguracaoSyncDto[]>("/admin/sync/configuracoes", { cache: "no-store" }),
      adminApiFetch<RegistrosIncompletosDto>("/admin/sync/registros-incompletos", {
        cache: "no-store",
      }),
    ]);
    configuracoes = configs;
    registrosIncompletos = registros;

    const logs = await Promise.all(
      configuracoes.map((config) =>
        adminApiFetch<PaginatedResult<SyncLogResumoDto>>(
          `/admin/sync/${encodeURIComponent(config.nomeEntidade)}/logs?page=1&limit=1`,
          { cache: "no-store" },
        ),
      ),
    );
    configuracoes.forEach((config, indice) => {
      ultimosLogs.set(config.nomeEntidade, logs[indice].data[0]);
    });
  } catch (error) {
    erroCarregamento =
      error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Central de sincronização</h1>

      {erroCarregamento ? (
        <ErroConexao mensagem={erroCarregamento} />
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {configuracoes.map((config) => {
              const status = configStatusSyncLog(ultimosLogs.get(config.nomeEntidade)?.status);
              const restrito = ENTIDADES_SEM_CURSOR_INCREMENTAL.has(config.nomeEntidade);

              return (
                <Card key={config.nomeEntidade}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-ink">
                        {rotuloEntidade(config.nomeEntidade)}
                      </p>
                      <p className="text-sm text-muted">
                        Última sincronização: {formatarData(config.ultimaSincronizacaoEm)} ·
                        Cadência atual: {rotuloTipoCadencia(config.tipoCadencia)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge enfase={status.enfase}>{status.rotulo}</Badge>
                      <RodarAgoraForm nomeEntidade={config.nomeEntidade} />
                    </div>
                  </div>

                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium text-primary">
                      Editar cadência
                    </summary>
                    <CadenciaForm config={config} restrito={restrito} />
                  </details>

                  <Link
                    href={`/admin/sincronizacao/${config.nomeEntidade}/logs`}
                    className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    Ver logs →
                  </Link>
                </Card>
              );
            })}
          </div>

          <h2 className="text-xl font-bold text-ink">Registros incompletos</h2>
          {registrosIncompletos && (
            <div className="flex flex-col gap-4">
              {(["cliente", "produto", "pedido"] as const).map((tipo) => {
                const registros = registrosIncompletos![tipo];
                return (
                  <Card key={tipo}>
                    <p className="text-sm font-semibold capitalize text-ink">
                      {tipo}s pendentes ({registros.length})
                    </p>
                    {registros.length === 0 ? (
                      <p className="mt-2 text-sm text-muted">Nenhum registro incompleto.</p>
                    ) : (
                      <div className="mt-3 flex flex-col gap-2">
                        {registros.map((registro) => (
                          <div
                            key={registro.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-ink">{registro.idExternoErp}</span>
                            <span className="text-muted">{registro.idadeEmHoras}h incompleto</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
