import Form from "next/form";
import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { MeuVendedorDto } from "@/lib/vendedores";
import {
  mesAnoAtual,
  periodoAtual,
  rotuloMesAno,
  rotuloPeriodo,
  rotuloTipoMeta,
  semanaIsoAtual,
  type MetaProgressoDto,
  type RankingEquipeItemDto,
  type TipoPeriodicidadeMeta,
} from "@/lib/metas";
import { formatarMoeda, formatarPeso } from "@/lib/formatacao";
import { Card } from "@/components/design/card";
import { PrimaryButton } from "@/components/design/button";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";

const REGEX_MES_ANO = /^\d{4}-(0[1-9]|1[0-2])$/;
const REGEX_SEMANA_ISO = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

// Meta em Dinheiro (R$) ou Peso (Kg) - Margem ainda sem cálculo de
// progresso (ver lib/metas.ts, TipoMeta), então "vendido"/"meta" nem
// chegam a ser mostrados nesse caso, só o rótulo do tipo.
function formatarValorPorTipo(tipoMeta: MetaProgressoDto["tipoMeta"], valor: number): string {
  return tipoMeta === "PESO" ? formatarPeso(String(valor)) : formatarMoeda(String(valor));
}

// OS-pendentes-claude-code.md - GET /vendedores/:id/meta-progresso e
// GET /equipe/ranking ja existiam pro mobile (OS-BACKEND-44), sem tela web
// nenhuma. Meta/progresso e' sempre "o proprio vendedor" aqui (GET /me ja
// resolve o vendedorId de quem esta logado - admin/supervisor sem vinculo
// de Vendedor simplesmente nao tem meta pra ver, so ranking). Ranking pode
// vir vazio/403 dependendo do papel e de ConfiguracaoGamificacao
// (rankingVisivelParaVendedor) - tratado como "seção ausente", nao erro.
//
// Pedido do usuario (2026-09-28): mensal e semanal podem coexistir - por
// isso dois cards de progresso separados (um por periodicidade), cada um
// com seu proprio filtro de periodo. Ranking continua so mensal (fora de
// escopo do pedido, ver metas.controller.ts).
export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<{ mesAno?: string; semana?: string }>;
}) {
  await exigirUsuarioAutenticado("/metas");

  const params = await searchParams;
  const mesAno = params.mesAno && REGEX_MES_ANO.test(params.mesAno) ? params.mesAno : mesAnoAtual();
  const semana =
    params.semana && REGEX_SEMANA_ISO.test(params.semana) ? params.semana : semanaIsoAtual();

  const meuVendedor = await apiFetch<MeuVendedorDto>("/vendedores/me", { cache: "no-store" }).catch(
    () => ({ vendedorId: null, papel: null, podeAprovar: false }) as MeuVendedorDto,
  );

  async function buscarProgresso(
    periodicidade: TipoPeriodicidadeMeta,
    periodo: string,
  ): Promise<{ progresso: MetaProgressoDto | null; erro: string | null }> {
    if (!meuVendedor.vendedorId) {
      return { progresso: null, erro: null };
    }
    try {
      const progresso = await apiFetch<MetaProgressoDto>(
        `/vendedores/${encodeURIComponent(meuVendedor.vendedorId)}/meta-progresso?periodicidade=${periodicidade}&periodo=${encodeURIComponent(periodo)}`,
        { cache: "no-store" },
      );
      return { progresso, erro: null };
    } catch (error) {
      return {
        progresso: null,
        erro: error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.",
      };
    }
  }

  const [{ progresso: progressoMensal, erro: erroMensal }, { progresso: progressoSemanal, erro: erroSemanal }] =
    await Promise.all([buscarProgresso("MENSAL", mesAno), buscarProgresso("SEMANAL", semana)]);

  let ranking: RankingEquipeItemDto[] | null = null;
  try {
    ranking = await apiFetch<RankingEquipeItemDto[]>(`/equipe/ranking?mesAno=${mesAno}`, {
      cache: "no-store",
    });
  } catch {
    // 403 (sem vendedor vinculado, ou ranking desligado pro papel) - seção
    // some da tela em vez de mostrar erro (mesmo criterio de secoes
    // secundarias em clientes/[id]/page.tsx).
    ranking = null;
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Metas e ranking</h1>

      <div className="flex flex-wrap gap-6">
        <section className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">Minha meta mensal - {rotuloMesAno(mesAno)}</h2>
            <Form action="/metas" scroll={false} className="flex items-end gap-2">
              <input type="hidden" name="semana" value={semana} />
              <input
                type="month"
                name="mesAno"
                defaultValue={mesAno}
                className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
              />
              <PrimaryButton type="submit">Aplicar</PrimaryButton>
            </Form>
          </div>
          <CardProgresso
            vendedorVinculado={!!meuVendedor.vendedorId}
            progresso={progressoMensal}
            erro={erroMensal}
            periodicidade="MENSAL"
            periodo={mesAno}
          />
        </section>

        <section className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">
              Minha meta semanal - {rotuloPeriodo("SEMANAL", semana)}
            </h2>
            <Form action="/metas" scroll={false} className="flex items-end gap-2">
              <input type="hidden" name="mesAno" value={mesAno} />
              <input
                type="week"
                name="semana"
                defaultValue={semana}
                className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
              />
              <PrimaryButton type="submit">Aplicar</PrimaryButton>
            </Form>
          </div>
          <CardProgresso
            vendedorVinculado={!!meuVendedor.vendedorId}
            progresso={progressoSemanal}
            erro={erroSemanal}
            periodicidade="SEMANAL"
            periodo={semana}
          />
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Ranking da equipe - {rotuloMesAno(mesAno)}</h2>
        {ranking === null ? (
          <p className="text-sm text-muted">Ranking não disponível pro seu perfil.</p>
        ) : ranking.length === 0 ? (
          <EstadoVazio mensagem="Nenhum vendedor no ranking pra este mês." />
        ) : (
          <Card>
            <ol className="flex flex-col gap-2">
              {ranking.map((item, indice) => (
                <li
                  key={item.vendedorId}
                  className="flex items-center justify-between gap-4 border-b border-background pb-2 text-sm last:border-none last:pb-0"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-xs font-semibold text-muted">
                      {indice + 1}
                    </span>
                    <span
                      className={
                        item.vendedorId === meuVendedor.vendedorId
                          ? "font-semibold text-ink"
                          : "text-ink"
                      }
                    >
                      {item.nome ?? "—"}
                      {item.vendedorId === meuVendedor.vendedorId ? " (você)" : ""}
                    </span>
                  </span>
                  <span className="font-medium text-ink">{formatarMoeda(String(item.valorVendido))}</span>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </section>
    </main>
  );
}

function CardProgresso({
  vendedorVinculado,
  progresso,
  erro,
  periodicidade,
  periodo,
}: {
  vendedorVinculado: boolean;
  progresso: MetaProgressoDto | null;
  erro: string | null;
  periodicidade: TipoPeriodicidadeMeta;
  periodo: string;
}) {
  if (!vendedorVinculado) {
    return <EstadoVazio mensagem="Seu usuário não está vinculado a um vendedor - sem meta pra exibir." />;
  }
  if (erro) {
    return <ErroConexao mensagem={erro} />;
  }
  if (!progresso || progresso.valorMeta === null || progresso.tipoMeta === null) {
    return (
      <EstadoVazio
        mensagem={`Nenhuma meta ${periodicidade === "MENSAL" ? "mensal" : "semanal"} configurada pra ${rotuloPeriodo(periodicidade, periodo)} ainda.`}
      />
    );
  }

  const percentual = progresso.percentualAtingido;
  const margemSemCalculo = progresso.tipoMeta === "MARGEM";

  return (
    <Card className="flex flex-col gap-3">
      <span className="text-xs font-medium text-muted">{rotuloTipoMeta(progresso.tipoMeta)}</span>
      {margemSemCalculo ? (
        <p className="text-sm text-muted">
          Meta: <span className="font-semibold text-ink">{progresso.valorMeta}%</span> - cálculo de
          progresso ainda não disponível pra este tipo.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm text-muted">
              Vendido:{" "}
              <span className="font-semibold text-ink">
                {formatarValorPorTipo(progresso.tipoMeta, progresso.valorVendido)}
              </span>
            </span>
            <span className="text-sm text-muted">
              Meta:{" "}
              <span className="font-semibold text-ink">
                {formatarValorPorTipo(progresso.tipoMeta, progresso.valorMeta)}
              </span>
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(percentual ?? 0, 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted">{(percentual ?? 0).toFixed(1)}% atingido</span>
        </>
      )}
    </Card>
  );
}
