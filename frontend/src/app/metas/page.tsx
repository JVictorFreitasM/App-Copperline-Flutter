import Form from "next/form";
import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { MeuVendedorDto } from "@/lib/vendedores";
import {
  mesAnoAtual,
  rotuloMesAno,
  type MetaProgressoDto,
  type RankingEquipeItemDto,
} from "@/lib/metas";
import { formatarMoeda } from "@/lib/formatacao";
import { Card } from "@/components/design/card";
import { PrimaryButton } from "@/components/design/button";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";

const REGEX_MES_ANO = /^\d{4}-(0[1-9]|1[0-2])$/;

// OS-pendentes-claude-code.md - GET /vendedores/:id/meta-progresso e
// GET /equipe/ranking ja existiam pro mobile (OS-BACKEND-44), sem tela web
// nenhuma. Meta/progresso e' sempre "o proprio vendedor" aqui (GET /me ja
// resolve o vendedorId de quem esta logado - admin/supervisor sem vinculo
// de Vendedor simplesmente nao tem meta pra ver, so ranking). Ranking pode
// vir vazio/403 dependendo do papel e de ConfiguracaoGamificacao
// (rankingVisivelParaVendedor) - tratado como "seção ausente", nao erro.
export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<{ mesAno?: string }>;
}) {
  await exigirUsuarioAutenticado("/metas");

  const mesAnoParam = (await searchParams).mesAno;
  const mesAno = mesAnoParam && REGEX_MES_ANO.test(mesAnoParam) ? mesAnoParam : mesAnoAtual();

  const meuVendedor = await apiFetch<MeuVendedorDto>("/vendedores/me", { cache: "no-store" }).catch(
    () => ({ vendedorId: null, papel: null, podeAprovar: false }) as MeuVendedorDto,
  );

  let progresso: MetaProgressoDto | null = null;
  let erroProgresso: string | null = null;
  if (meuVendedor.vendedorId) {
    try {
      progresso = await apiFetch<MetaProgressoDto>(
        `/vendedores/${encodeURIComponent(meuVendedor.vendedorId)}/meta-progresso?mesAno=${mesAno}`,
        { cache: "no-store" },
      );
    } catch (error) {
      erroProgresso = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
    }
  }

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

  const percentual = progresso?.percentualAtingido;

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Metas e ranking</h1>

      <Form action="/metas" scroll={false} className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Mês
          <input
            type="month"
            name="mesAno"
            defaultValue={mesAno}
            className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          />
        </label>
        <PrimaryButton type="submit">Aplicar</PrimaryButton>
      </Form>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Minha meta - {rotuloMesAno(mesAno)}</h2>
        {!meuVendedor.vendedorId ? (
          <EstadoVazio mensagem="Seu usuário não está vinculado a um vendedor - sem meta pra exibir." />
        ) : erroProgresso ? (
          <ErroConexao mensagem={erroProgresso} />
        ) : progresso && progresso.valorMeta === null ? (
          <EstadoVazio mensagem="Nenhuma meta configurada pra este mês ainda." />
        ) : progresso ? (
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-muted">
                Vendido: <span className="font-semibold text-ink">{formatarMoeda(String(progresso.valorVendido))}</span>
              </span>
              <span className="text-sm text-muted">
                Meta: <span className="font-semibold text-ink">{formatarMoeda(String(progresso.valorMeta))}</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(percentual ?? 0, 100)}%` }}
              />
            </div>
            <span className="text-xs text-muted">{(percentual ?? 0).toFixed(1)}% atingido</span>
          </Card>
        ) : null}
      </section>

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
