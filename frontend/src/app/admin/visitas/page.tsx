import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { PaginatedResult } from "@/lib/pagination";
import { statusVisita, type VisitaEquipeDto } from "@/lib/visitas";
import type { VendedorEquipeDto } from "@/lib/vendedores";
import { formatarDataHora } from "@/lib/formatacao";
import { Card } from "@/components/design/card";
import { PrimaryButton } from "@/components/design/button";
import { Badge } from "@/components/badge";
import { Paginacao } from "@/components/paginacao";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { FotoVisita } from "./foto-visita";

const LIMITE_POR_PAGINA = 20;

function coordenadas(lat: number | null, lng: number | null): string {
  if (lat === null || lng === null) return "—";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function distancia(metros: number | null): string {
  return metros === null ? "—" : `${Math.round(metros)}m do pin do cliente`;
}

// Painel de revisão do supervisor (OS-WEB-26) - consome GET /visitas (lista
// escopada por hierarquia, ver VendedorEscopoService) e GET /visitas/:id/foto
// (via Route Handler local, ver app/api/visitas/[id]/foto/route.ts - a foto
// é binária, não JSON, apiFetch não serve pra isso). Sessão SSO normal, sem
// gate por role:'admin' - "Supervisor só visualiza a equipe; gerente/admin
// veem tudo" (critério de aceite) é resolvido pelo PRÓPRIO backend: um 403
// vira "sem permissão", não notFound(), porque qualquer supervisor/gerente
// legítimo deve chegar até aqui. Só leitura/auditoria - nenhuma ação
// corretiva aqui (fora de escopo da OS), nem mapa de trajeto (isso é
// OS-WEB-24, painel separado).
export default async function AdminVisitasPage({
  searchParams,
}: {
  searchParams: Promise<{
    vendedorId?: string;
    clienteId?: string;
    dataInicial?: string;
    dataFinal?: string;
    page?: string;
  }>;
}) {
  await exigirUsuarioAutenticado("/admin/visitas");

  const { vendedorId, clienteId, dataInicial, dataFinal, page } = await searchParams;
  const paginaParam = Number(page);
  const pagina = Number.isInteger(paginaParam) && paginaParam > 0 ? paginaParam : 1;

  let resultado: PaginatedResult<VisitaEquipeDto> | null = null;
  let equipe: VendedorEquipeDto[] = [];
  let semPermissao = false;
  let erro: string | null = null;

  try {
    const query = new URLSearchParams({
      page: String(pagina),
      limit: String(LIMITE_POR_PAGINA),
      ...(vendedorId && { vendedorId }),
      ...(clienteId && { clienteId }),
      ...(dataInicial && { dataInicial }),
      ...(dataFinal && { dataFinal }),
    });
    [resultado, equipe] = await Promise.all([
      apiFetch<PaginatedResult<VisitaEquipeDto>>(`/visitas?${query}`, { cache: "no-store" }),
      apiFetch<VendedorEquipeDto[]>("/vendedores/equipe", { cache: "no-store" }),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      semPermissao = true;
    } else {
      erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
    }
  }

  const visitas = resultado?.data ?? [];
  const canceladas = visitas.filter((v) => v.canceladaEm !== null);
  const demais = visitas.filter((v) => v.canceladaEm === null);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Check-ins e visitas da equipe</h1>

      {semPermissao ? (
        <Card>
          <p className="text-sm text-muted">
            Você não tem papel de supervisão (supervisor ou gerente) - nenhuma visita de equipe
            para revisar aqui.
          </p>
        </Card>
      ) : erro ? (
        <ErroConexao mensagem={erro} />
      ) : (
        <>
          <Card>
            <form method="get" action="/admin/visitas" className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm text-muted">
                Vendedor
                <select
                  name="vendedorId"
                  defaultValue={vendedorId ?? ""}
                  className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                >
                  <option value="">Toda a equipe</option>
                  {equipe.map((vendedor) => (
                    <option key={vendedor.id} value={vendedor.id}>
                      {vendedor.nome ?? vendedor.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-muted">
                Cliente (ID)
                <input
                  type="text"
                  name="clienteId"
                  defaultValue={clienteId}
                  className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-primary-light"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-muted">
                De
                <input
                  type="date"
                  name="dataInicial"
                  defaultValue={dataInicial}
                  className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-muted">
                Até
                <input
                  type="date"
                  name="dataFinal"
                  defaultValue={dataFinal}
                  className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                />
              </label>
              <PrimaryButton type="submit">Filtrar</PrimaryButton>
            </form>
          </Card>

          {canceladas.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-ink">
                Cancelamentos ({canceladas.length})
              </h2>
              <div className="flex flex-col gap-3">
                {canceladas.map((visita) => (
                  <Card key={visita.id} className="border-2 border-ink">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {visita.vendedor.nome ?? "Vendedor não identificado"} · Cliente{" "}
                          {visita.cliente.razaoSocial ?? "não identificado"}
                        </p>
                        <p className="mt-1 text-sm text-ink">
                          &ldquo;{visita.motivoCancelamento}&rdquo;
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          Check-in às {formatarDataHora(visita.checkinEm)} · cancelada às{" "}
                          {formatarDataHora(visita.canceladaEm)}
                        </p>
                      </div>
                      <Badge>Cancelada</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink">Visitas ({demais.length})</h2>
            {demais.length === 0 ? (
              <EstadoVazio mensagem="Nenhuma visita (não cancelada) encontrada com esse filtro." />
            ) : (
              <div className="flex flex-col gap-3">
                {demais.map((visita) => {
                  const status = statusVisita(visita);
                  return (
                    <Card key={visita.id}>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-ink">
                            {visita.vendedor.nome ?? "Vendedor não identificado"} · Cliente{" "}
                            {visita.cliente.razaoSocial ?? "não identificado"}
                          </p>
                          <p className="text-xs text-muted">
                            Check-in às {formatarDataHora(visita.checkinEm)} (data/hora validada
                            contra o EXIF da foto) · {distancia(visita.distanciaCheckinMetros)}
                          </p>
                          <p className="text-xs text-muted">
                            Coordenadas do check-in:{" "}
                            {coordenadas(visita.checkinLat, visita.checkinLng)}
                          </p>
                          {visita.checkoutEm && (
                            <p className="text-xs text-muted">
                              Checkout às {formatarDataHora(visita.checkoutEm)} ·{" "}
                              {distancia(visita.distanciaCheckoutMetros)} · coordenadas{" "}
                              {coordenadas(visita.checkoutLat, visita.checkoutLng)}
                            </p>
                          )}
                          {visita.nota && (
                            <p className="mt-1 text-xs text-muted">Nota: {visita.nota}</p>
                          )}
                        </div>
                        <Badge enfase={status.enfase}>{status.rotulo}</Badge>
                      </div>
                      {visita.temFoto && (
                        <div className="mt-3">
                          <FotoVisita visitaId={visita.id} />
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {resultado && (
            <Paginacao
              rota="/admin/visitas"
              pagina={resultado.meta.page}
              totalPaginas={resultado.meta.totalPages}
              filtros={{ vendedorId, clienteId, dataInicial, dataFinal }}
            />
          )}
        </>
      )}
    </main>
  );
}
