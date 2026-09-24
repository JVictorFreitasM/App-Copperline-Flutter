import { notFound } from "next/navigation";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { adminApiFetch } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import type { VendedorListaDto } from "@/lib/vendedores";
import type { ConfiguracaoGamificacaoDto } from "@/lib/metas";
import { Card } from "@/components/design/card";
import { Badge } from "@/components/badge";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { DefinirMetaForm } from "./definir-meta-form";
import { RankingVisivelToggle } from "./ranking-visivel-toggle";

// OS-pendentes-claude-code.md - "sem tela pra admin definir meta de
// vendedor, sem painel de gamificacao/ranking no web" (mobile ja consumia
// os dois GET). PATCH /admin/vendedores/:id/meta e GET/PATCH
// /admin/gamificacao/configuracao sao ApiKeyGuard-only (ver
// AdminMetasController/AdminGamificacaoController) - mesmo padrao das
// outras telas /admin/*: adminApiFetch, role:'admin' controlado aqui.
export default async function AdminMetasPage() {
  const usuario = await exigirUsuarioAutenticado("/admin/metas");
  if (usuario.role !== "admin") {
    notFound();
  }

  let vendedores: VendedorListaDto[] = [];
  let configuracao: ConfiguracaoGamificacaoDto | null = null;
  let erro: string | null = null;

  try {
    [vendedores, configuracao] = await Promise.all([
      adminApiFetch<VendedorListaDto[]>("/admin/vendedores", { cache: "no-store" }),
      adminApiFetch<ConfiguracaoGamificacaoDto>("/admin/gamificacao/configuracao", {
        cache: "no-store",
      }),
    ]);
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Metas e gamificação</h1>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink">Configuração de ranking</h2>
            <Card>
              {configuracao && <RankingVisivelToggle visivelInicial={configuracao.rankingVisivelParaVendedor} />}
            </Card>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink">Meta por vendedor</h2>
            {vendedores.length === 0 ? (
              <EstadoVazio mensagem="Nenhum vendedor sincronizado ainda." />
            ) : (
              <div className="flex flex-col gap-3">
                {vendedores.map((vendedor) => (
                  <Card key={vendedor.id}>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {vendedor.nome ?? "Vendedor sem nome"}
                        </p>
                        <p className="text-xs text-muted">{vendedor.email ?? "sem e-mail"}</p>
                      </div>
                      {vendedor.inativo && <Badge>Inativo</Badge>}
                    </div>
                    <div className="mt-3">
                      <DefinirMetaForm vendedorId={vendedor.id} />
                    </div>
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
