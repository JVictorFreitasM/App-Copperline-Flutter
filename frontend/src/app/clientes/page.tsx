import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { ClienteResumoDto } from "@/lib/clientes";
import type { PaginatedResult } from "@/lib/pagination";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { Paginacao } from "@/components/paginacao";
import { BadgeAtivoInativo } from "@/components/badge";
import { FiltroForm, CampoFiltro } from "@/components/filtro";
import { ListItem } from "@/components/design/list-item";

const LIMITE_POR_PAGINA = 20;

// Primeira tela de negocio de verdade do sistema (OS-WEB-11) - consome
// GET /clientes (OS-BACKEND-11). Server Component: busca acontece no
// servidor via apiFetch (src/lib/api.ts), que ja repassa o cookie de
// sessao pro backend. Filtro (nome/CPF-CNPJ) e link pro detalhe
// adicionados na OS-WEB-15, reaproveitando os filtros que a API ja expõe.
// Retrofit visual (OS-WEB-16): tabela virou lista de ListItem, mesmo dado.
export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; nome?: string; cpfCnpj?: string }>;
}) {
  await exigirUsuarioAutenticado("/clientes");

  const params = await searchParams;
  const paginaParam = Number(params.page);
  const pagina = Number.isInteger(paginaParam) && paginaParam > 0 ? paginaParam : 1;
  const nome = params.nome?.trim() || undefined;
  const cpfCnpj = params.cpfCnpj?.trim() || undefined;

  let resultado: PaginatedResult<ClienteResumoDto> | null = null;
  let erro: string | null = null;

  try {
    const query = new URLSearchParams({
      page: String(pagina),
      limit: String(LIMITE_POR_PAGINA),
      ...(nome && { nome }),
      ...(cpfCnpj && { cpfCnpj }),
    });
    resultado = await apiFetch<PaginatedResult<ClienteResumoDto>>(`/clientes?${query}`, {
      cache: "no-store",
    });
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Clientes</h1>

      <FiltroForm rota="/clientes">
        <CampoFiltro label="Nome / Razão social" name="nome" defaultValue={nome} />
        <CampoFiltro label="CPF/CNPJ" name="cpfCnpj" defaultValue={cpfCnpj} />
      </FiltroForm>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : resultado && resultado.data.length === 0 ? (
        <EstadoVazio mensagem="Nenhum cliente encontrado." />
      ) : (
        resultado && (
          <>
            <div className="flex flex-col gap-3">
              {resultado.data.map((cliente) => {
                const titulo = cliente.razaoSocial ?? cliente.nomeFantasia ?? "—";
                return (
                  <ListItem
                    key={cliente.id}
                    href={`/clientes/${cliente.id}`}
                    avatar={titulo.charAt(0).toUpperCase()}
                    titulo={titulo}
                    subtitulo={cliente.cpfCnpj ?? "Sem CPF/CNPJ"}
                    tag={<BadgeAtivoInativo inativo={cliente.inativo} />}
                  />
                );
              })}
            </div>

            <Paginacao
              rota="/clientes"
              pagina={resultado.meta.page}
              totalPaginas={resultado.meta.totalPages}
              filtros={{ nome, cpfCnpj }}
            />
          </>
        )
      )}
    </main>
  );
}
