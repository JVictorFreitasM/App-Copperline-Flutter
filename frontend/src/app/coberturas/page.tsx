import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { CoberturaResumoDto, CoberturaTemporariaDto } from "@/lib/coberturas";
import { formatarData } from "@/lib/formatacao";
import { Card } from "@/components/design/card";
import { Badge } from "@/components/badge";
import { EstadoVazio, ErroConexao } from "@/components/listagem-feedback";

// OS-pendentes-claude-code.md - GET /coberturas/:id/resumo ja existia
// (OS-BACKEND-48), sem tela web. GET /coberturas/minha-ativa e' novo (esta
// OS) - sem ele o substituto nao tinha como descobrir o id da propria
// cobertura ativa pra abrir esse resumo (so existia GET /admin/coberturas,
// que lista TUDO, ApiKeyGuard).
export default async function CoberturasPage() {
  await exigirUsuarioAutenticado("/coberturas");

  let cobertura: CoberturaTemporariaDto | null = null;
  let resumo: CoberturaResumoDto | null = null;
  let erro: string | null = null;

  try {
    cobertura = await apiFetch<CoberturaTemporariaDto | null>("/coberturas/minha-ativa", {
      cache: "no-store",
    });
    if (cobertura) {
      resumo = await apiFetch<CoberturaResumoDto>(
        `/coberturas/${encodeURIComponent(cobertura.id)}/resumo`,
        { cache: "no-store" },
      );
    }
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Cobertura temporária</h1>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : !cobertura ? (
        <Card>
          <p className="text-sm text-muted">
            Você não está cobrindo a carteira de nenhum vendedor no momento.
          </p>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-ink">
                Você está cobrindo a carteira de{" "}
                <span className="font-medium">{cobertura.vendedorOriginalNome ?? "—"}</span>
              </p>
              <Badge enfase>Ativa</Badge>
            </div>
            <p className="mt-1 text-xs text-muted">
              {formatarData(cobertura.dataInicio)} até {formatarData(cobertura.dataFim)}
            </p>
          </Card>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink">Resumo de handoff por cliente</h2>
            {!resumo || resumo.clientes.length === 0 ? (
              <EstadoVazio mensagem="Nenhum cliente na carteira coberta." />
            ) : (
              <div className="flex flex-col gap-3">
                {resumo.clientes.map((cliente) => (
                  <Card key={cliente.clienteId}>
                    <p className="text-sm font-medium text-ink">
                      {cliente.clienteNome ?? "Cliente não identificado"}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {cliente.resumo ?? "Resumo indisponível pra este cliente."}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
