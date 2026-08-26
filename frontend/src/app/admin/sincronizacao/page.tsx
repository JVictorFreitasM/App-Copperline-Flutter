import { notFound } from "next/navigation";
import Link from "next/link";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { adminApiFetch } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import type { PaginatedResult } from "@/lib/pagination";
import {
  configStatusSyncLog,
  DIAS_SEMANA,
  ENTIDADES_SEM_CURSOR_INCREMENTAL,
  rotuloEntidade,
  rotuloTipoCadencia,
  type ConfiguracaoSyncDto,
  type RegistrosIncompletosDto,
  type SyncLogResumoDto,
} from "@/lib/admin-sync";
import { Card } from "@/components/design/card";
import { PrimaryButton, SecondaryButton } from "@/components/design/button";
import { Badge } from "@/components/badge";
import { ErroConexao } from "@/components/listagem-feedback";
import { atualizarCadencia, rodarAgora } from "./actions";

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
export default async function SincronizacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const usuario = await exigirUsuarioAutenticado("/admin/sincronizacao");
  if (usuario.role !== "admin") {
    notFound();
  }

  const { erro: erroQuery, sucesso } = await searchParams;

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

      {erroQuery && <ErroConexao mensagem={decodeURIComponent(erroQuery)} />}
      {sucesso && (
        <Card>
          <p className="text-sm font-medium text-ink">{decodeURIComponent(sucesso)}</p>
        </Card>
      )}

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
                      <form action={rodarAgora.bind(null, config.nomeEntidade)}>
                        <SecondaryButton type="submit">Rodar agora</SecondaryButton>
                      </form>
                    </div>
                  </div>

                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium text-primary">
                      Editar cadência
                    </summary>
                    <form
                      action={atualizarCadencia.bind(null, config.nomeEntidade)}
                      className="mt-3 flex flex-col gap-3 rounded-card bg-background p-4"
                    >
                      {restrito && (
                        <p className="text-xs text-muted">
                          &apos;{rotuloEntidade(config.nomeEntidade)}&apos; não suporta cadência
                          Incremental — o ERP não permite filtrar só o que mudou pra essa entidade
                          (limitação estrutural, não configurável). Use Configurável (intervalo
                          fixo) ou um horário fixo.
                        </p>
                      )}
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                        Tipo de cadência
                        <select
                          name="tipoCadencia"
                          defaultValue={config.tipoCadencia}
                          className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                        >
                          <option value="INCREMENTAL" disabled={restrito}>
                            Incremental
                          </option>
                          <option value="CONFIGURAVEL">Configurável (intervalo fixo)</option>
                          <option value="INCREMENTAL_NOTURNO">
                            Incremental noturno (horário fixo)
                          </option>
                          <option value="JANELA_FIXA_DIARIA">
                            Janela fixa diária (horário fixo)
                          </option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                        Intervalo em minutos (obrigatório para Incremental/Configurável)
                        <input
                          type="number"
                          name="intervaloMinutos"
                          min={1}
                          defaultValue={config.intervaloMinutos ?? undefined}
                          className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                        Horário fixo HH:mm (obrigatório para Incremental noturno/Janela fixa
                        diária)
                        <input
                          type="text"
                          name="horarioFixo"
                          placeholder="HH:mm"
                          defaultValue={config.horarioFixo ?? undefined}
                          className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                        />
                      </label>
                      <fieldset className="flex flex-col gap-1 text-xs font-medium text-muted">
                        <legend>Dias da semana (nenhum marcado = todos os dias)</legend>
                        <div className="flex flex-wrap gap-3">
                          {DIAS_SEMANA.map((dia, indice) => (
                            <label
                              key={dia}
                              className="flex items-center gap-1 font-normal text-ink"
                            >
                              <input
                                type="checkbox"
                                name="diasSemana"
                                value={indice}
                                defaultChecked={config.diasSemana.includes(indice)}
                              />
                              {dia}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <PrimaryButton type="submit" className="self-start">
                        Salvar cadência
                      </PrimaryButton>
                    </form>
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
