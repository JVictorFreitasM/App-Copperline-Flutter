import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { MeuVendedorDto, VendedorEquipeDto } from "@/lib/vendedores";
import { rotuloMotivo, type OportunidadeClienteDto } from "@/lib/oportunidades";
import { formatarData } from "@/lib/formatacao";
import { Card } from "@/components/design/card";
import { PrimaryButton } from "@/components/design/button";
import { Badge } from "@/components/badge";
import { EstadoVazio, ErroConexao } from "@/components/listagem-feedback";

const LIMIAR_PADRAO = 45;

// OS-pendentes-claude-code.md - GET /vendedores/:id/oportunidades ja
// existia (OS-BACKEND-45), sem tela web. Motor 100% determinístico (quem
// entra na lista, ver docs/02-modulos-funcionais.md) - a IA só fraseia o
// motivo já calculado (campo `contexto`, pode vir null). Vendedor comum ve
// so a si mesmo (selector de vendedor some quando a equipe tem 1 nome so).
export default async function OportunidadesPage({
  searchParams,
}: {
  searchParams: Promise<{ vendedorId?: string; limiarDiasSemPedido?: string }>;
}) {
  await exigirUsuarioAutenticado("/oportunidades");

  const params = await searchParams;
  const limiarParam = Number(params.limiarDiasSemPedido);
  const limiar =
    Number.isInteger(limiarParam) && limiarParam >= 1 && limiarParam <= 365
      ? limiarParam
      : LIMIAR_PADRAO;

  const meuVendedor = await apiFetch<MeuVendedorDto>("/vendedores/me", { cache: "no-store" }).catch(
    () => ({ vendedorId: null, papel: null, podeAprovar: false }) as MeuVendedorDto,
  );
  const equipe = await apiFetch<VendedorEquipeDto[]>("/vendedores/equipe", {
    cache: "no-store",
  }).catch(() => [] as VendedorEquipeDto[]);

  const vendedorId = params.vendedorId || meuVendedor.vendedorId || equipe[0]?.id || null;

  let oportunidades: OportunidadeClienteDto[] = [];
  let erro: string | null = null;
  let semVendedor = false;

  if (!vendedorId) {
    semVendedor = true;
  } else {
    try {
      oportunidades = await apiFetch<OportunidadeClienteDto[]>(
        `/vendedores/${encodeURIComponent(vendedorId)}/oportunidades?limiarDiasSemPedido=${limiar}`,
        { cache: "no-store" },
      );
    } catch (error) {
      erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Oportunidades</h1>
      <p className="text-sm text-muted">
        Clientes que merecem atenção agora, por regra (sem pedido há tempo, recompra próxima,
        aniversário de relacionamento) - a frase de contexto é gerada por IA a partir do motivo já
        calculado, nunca decide sozinha quem aparece aqui.
      </p>

      {semVendedor ? (
        <Card>
          <p className="text-sm text-muted">
            Seu usuário não está vinculado a um vendedor - sem oportunidades pra exibir.
          </p>
        </Card>
      ) : (
        <>
          <Card>
            <form method="get" action="/oportunidades" className="flex flex-wrap items-end gap-3">
              {equipe.length > 1 && (
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  Vendedor
                  <select
                    name="vendedorId"
                    defaultValue={vendedorId ?? ""}
                    className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                  >
                    {equipe.map((vendedor) => (
                      <option key={vendedor.id} value={vendedor.id}>
                        {vendedor.nome ?? vendedor.id}
                        {vendedor.id === meuVendedor.vendedorId ? " (você)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Sem pedido há pelo menos (dias)
                <input
                  type="number"
                  name="limiarDiasSemPedido"
                  min={1}
                  max={365}
                  defaultValue={limiar}
                  className="w-28 rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                />
              </label>
              <PrimaryButton type="submit">Aplicar</PrimaryButton>
            </form>
          </Card>

          {erro ? (
            <ErroConexao mensagem={erro} />
          ) : oportunidades.length === 0 ? (
            <EstadoVazio mensagem="Nenhuma oportunidade encontrada com esse filtro." />
          ) : (
            <div className="flex flex-col gap-3">
              {oportunidades.map((oportunidade) => (
                <Card key={oportunidade.clienteId}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {oportunidade.clienteNome ?? "Cliente não identificado"}
                      </p>
                      <p className="mt-1 text-xs text-muted">{rotuloMotivo(oportunidade.motivo)}</p>
                      {oportunidade.ultimaInteracaoEm && (
                        <p className="text-xs text-muted">
                          Último pedido em {formatarData(oportunidade.ultimaInteracaoEm)}
                        </p>
                      )}
                    </div>
                    <Badge enfase>{oportunidade.motivo.tipo.replaceAll("_", " ")}</Badge>
                  </div>
                  {oportunidade.contexto && (
                    <p className="mt-3 text-sm text-ink">{oportunidade.contexto}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
