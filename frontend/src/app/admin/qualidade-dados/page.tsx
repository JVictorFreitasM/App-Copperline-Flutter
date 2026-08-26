import { notFound } from "next/navigation";
import Link from "next/link";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { adminApiFetch } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import type { RegistroIncompletoDto, RegistrosIncompletosDto } from "@/lib/admin-sync";
import { formatarData } from "@/lib/formatacao";
import { Card } from "@/components/design/card";
import { ListItem } from "@/components/design/list-item";
import { Badge } from "@/components/badge";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";

type TipoRegistroIncompleto = "cliente" | "produto" | "pedido";

const ROTA_DETALHE: Record<TipoRegistroIncompleto, string> = {
  cliente: "/clientes",
  produto: "/produtos",
  pedido: "/pedidos",
};

const ROTULO_TIPO: Record<TipoRegistroIncompleto, string> = {
  cliente: "Clientes",
  produto: "Produtos",
  pedido: "Pedidos",
};

function ordenarPorIdade(
  registros: RegistroIncompletoDto[],
  ordem: "asc" | "desc",
): RegistroIncompletoDto[] {
  const copia = [...registros];
  copia.sort((a, b) =>
    ordem === "asc" ? a.idadeEmHoras - b.idadeEmHoras : b.idadeEmHoras - a.idadeEmHoras,
  );
  return copia;
}

// Tela de qualidade de dados (OS-WEB-20) - superfície só de visibilidade
// (fora de escopo: qualquer correção automática, ver OS) sobre o mesmo
// GET /admin/sync/registros-incompletos já usado na Central de
// Sincronização (OS-WEB-18) - reaproveita os tipos de lib/admin-sync.ts e
// o mesmo helper adminApiFetch (rota protegida por ApiKeyGuard, chave só
// no servidor Next.js). Mesmo controle de acesso: role:'admin', notFound()
// pros demais (404-não-403, mesmo critério anti-IDOR do backend).
export default async function QualidadeDadosPage({
  searchParams,
}: {
  searchParams: Promise<{ ordem?: string }>;
}) {
  const usuario = await exigirUsuarioAutenticado("/admin/qualidade-dados");
  if (usuario.role !== "admin") {
    notFound();
  }

  const { ordem: ordemParam } = await searchParams;
  const ordem: "asc" | "desc" = ordemParam === "asc" ? "asc" : "desc";

  let registrosIncompletos: RegistrosIncompletosDto | null = null;
  let erro: string | null = null;

  try {
    registrosIncompletos = await adminApiFetch<RegistrosIncompletosDto>(
      "/admin/sync/registros-incompletos",
      { cache: "no-store" },
    );
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  const totalRegistros = registrosIncompletos
    ? registrosIncompletos.cliente.length +
      registrosIncompletos.produto.length +
      registrosIncompletos.pedido.length
    : 0;

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Qualidade de dados</h1>
      <p className="text-sm text-muted">
        Registros criados como stub por uma sincronização (ex: nota fiscal referenciando um
        pedido/cliente ainda não sincronizado) e que aguardam a sincronização &ldquo;de
        verdade&rdquo; dessa entidade para ficar completos. Só visibilidade - nenhuma correção
        acontece por aqui.
      </p>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : (
        registrosIncompletos && (
          <>
            <div className="flex items-center justify-between text-sm text-muted">
              <span>{totalRegistros} registro(s) incompleto(s) no total</span>
              <div className="flex items-center gap-3">
                <span>Ordenar por idade:</span>
                <Link
                  href="/admin/qualidade-dados?ordem=desc"
                  className={`font-medium ${ordem === "desc" ? "text-ink" : "text-primary hover:underline"}`}
                >
                  Mais antigo primeiro
                </Link>
                <Link
                  href="/admin/qualidade-dados?ordem=asc"
                  className={`font-medium ${ordem === "asc" ? "text-ink" : "text-primary hover:underline"}`}
                >
                  Mais recente primeiro
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              {(Object.keys(ROTULO_TIPO) as TipoRegistroIncompleto[]).map((tipo) => {
                const registros = ordenarPorIdade(registrosIncompletos![tipo], ordem);
                return (
                  <section key={tipo} className="flex flex-col gap-3">
                    <h2 className="text-lg font-semibold text-ink">
                      {ROTULO_TIPO[tipo]} incompletos ({registros.length})
                    </h2>
                    {registros.length === 0 ? (
                      <Card>
                        <p className="text-sm text-muted">Nenhum registro incompleto.</p>
                      </Card>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {registros.map((registro) => (
                          <ListItem
                            key={registro.id}
                            href={`${ROTA_DETALHE[tipo]}/${registro.id}`}
                            titulo={`ID externo ${registro.idExternoErp}`}
                            subtitulo={`Incompleto desde ${formatarData(registro.incompletoDesde)}`}
                            valor={`${registro.idadeEmHoras}h`}
                            tag={<Badge enfase={registro.idadeEmHoras >= 24}>Incompleto</Badge>}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            {totalRegistros === 0 && (
              <EstadoVazio mensagem="Nenhum registro incompleto encontrado - sincronização alinhada." />
            )}
          </>
        )
      )}
    </main>
  );
}
