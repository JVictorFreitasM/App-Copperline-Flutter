import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import {
  clienteDaNotaFiscal,
  configStatusNfe,
  rotuloTipoNotaFiscal,
  type NotaFiscalDto,
} from "@/lib/notas-fiscais";
import { formatarData, formatarMoeda } from "@/lib/formatacao";
import type { PaginatedResult } from "@/lib/pagination";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { Paginacao } from "@/components/paginacao";
import { Badge } from "@/components/badge";
import { Card } from "@/components/design/card";
import { ListItem } from "@/components/design/list-item";

const LIMITE_POR_PAGINA = 20;

interface ListaNotasFiscaisDto extends PaginatedResult<NotaFiscalDto> {
  aviso: string;
}

// Quinta tela de negocio (OS-WEB-17) - consome GET /notas-fiscais
// (OS-BACKEND-13), ja nascendo com os componentes do design system
// (OS-WEB-16). Sem filtro nem tela de detalhe (fora de escopo desta OS -
// ver critério "Filtro de busca e tela de detalhe... numa extensão da
// OS-WEB-15"). O aviso da janela de 60 dias vem pronto do backend
// (`aviso` no corpo da resposta) - só renderizo, sem duplicar o texto.
export default async function NotasFiscaisPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await exigirUsuarioAutenticado("/notas-fiscais");

  const params = await searchParams;
  const paginaParam = Number(params.page);
  const pagina = Number.isInteger(paginaParam) && paginaParam > 0 ? paginaParam : 1;

  let resultado: ListaNotasFiscaisDto | null = null;
  let erro: string | null = null;

  try {
    const query = new URLSearchParams({
      page: String(pagina),
      limit: String(LIMITE_POR_PAGINA),
    });
    resultado = await apiFetch<ListaNotasFiscaisDto>(`/notas-fiscais?${query}`, {
      cache: "no-store",
    });
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Notas fiscais</h1>

      {resultado && (
        <Card className="text-sm text-muted">{resultado.aviso}</Card>
      )}

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : resultado && resultado.data.length === 0 ? (
        <EstadoVazio mensagem="Nenhuma nota fiscal encontrada." />
      ) : (
        resultado && (
          <>
            <div className="flex flex-col gap-3">
              {resultado.data.map((nota) => {
                const status = configStatusNfe(nota.statusNfe);
                const titulo = `Nota ${nota.numero ?? "—"}${nota.serie ? `/${nota.serie}` : ""}`;
                return (
                  <ListItem
                    key={nota.id}
                    avatar={rotuloTipoNotaFiscal(nota.tipo).charAt(0)}
                    titulo={titulo}
                    subtitulo={`${clienteDaNotaFiscal(nota)} · ${rotuloTipoNotaFiscal(nota.tipo)} · ${formatarData(nota.dataEmissao)}`}
                    valor={formatarMoeda(nota.valorTotalNotaFiscal)}
                    tag={<Badge enfase={status.enfase}>{status.rotulo}</Badge>}
                  />
                );
              })}
            </div>

            <Paginacao
              rota="/notas-fiscais"
              pagina={resultado.meta.page}
              totalPaginas={resultado.meta.totalPages}
            />
          </>
        )
      )}
    </main>
  );
}
