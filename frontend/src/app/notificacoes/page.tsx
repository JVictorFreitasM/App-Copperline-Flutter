import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { PaginatedResult } from "@/lib/pagination";
import type { NotificacaoDto } from "@/lib/notificacoes";
import { Paginacao } from "@/components/paginacao";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { NotificacaoItem } from "./notificacao-item";
import { MarcarTodasButton } from "./marcar-todas-button";

const LIMITE_POR_PAGINA = 20;

// Epico 5 - GET /notificacoes (paginado, "minhas notificacoes") e
// PATCH .../lida - .../marcar-todas-lidas, ja existentes no backend. Sino
// da Topbar (notificacao-sino.tsx) mostra so a contagem + as ultimas
// (dropdown); esta e' a tela cheia, com paginacao e filtro de nao lidas.
export default async function NotificacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; apenasNaoLidas?: string }>;
}) {
  await exigirUsuarioAutenticado("/notificacoes");

  const { page, apenasNaoLidas } = await searchParams;
  const paginaParam = Number(page);
  const pagina = Number.isInteger(paginaParam) && paginaParam > 0 ? paginaParam : 1;
  const somenteNaoLidas = apenasNaoLidas === "true";

  let resultado: PaginatedResult<NotificacaoDto> | null = null;
  let erro: string | null = null;

  try {
    const query = new URLSearchParams({
      page: String(pagina),
      limit: String(LIMITE_POR_PAGINA),
      ...(somenteNaoLidas && { apenasNaoLidas: "true" }),
    });
    resultado = await apiFetch<PaginatedResult<NotificacaoDto>>(`/notificacoes?${query}`, {
      cache: "no-store",
    });
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  const notificacoes = resultado?.data ?? [];

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-ink">Notificações</h1>
        <MarcarTodasButton />
      </div>

      <div className="flex gap-2 text-sm">
        <a
          href="/notificacoes"
          className={`rounded-full px-4 py-2 ${!somenteNaoLidas ? "bg-solid text-on-solid" : "bg-surface text-ink"}`}
        >
          Todas
        </a>
        <a
          href="/notificacoes?apenasNaoLidas=true"
          className={`rounded-full px-4 py-2 ${somenteNaoLidas ? "bg-solid text-on-solid" : "bg-surface text-ink"}`}
        >
          Não lidas
        </a>
      </div>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : notificacoes.length === 0 ? (
        <EstadoVazio mensagem="Nenhuma notificação por aqui." />
      ) : (
        <div className="flex flex-col gap-3">
          {notificacoes.map((notificacao) => (
            <NotificacaoItem key={notificacao.id} notificacao={notificacao} />
          ))}
        </div>
      )}

      {resultado && (
        <Paginacao
          rota="/notificacoes"
          pagina={resultado.meta.page}
          totalPaginas={resultado.meta.totalPages}
          filtros={{ apenasNaoLidas: somenteNaoLidas ? "true" : undefined }}
        />
      )}
    </main>
  );
}
