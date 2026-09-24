import { notFound } from "next/navigation";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { adminApiFetch } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import type { VendedorListaDto } from "@/lib/vendedores";
import type { CoberturaTemporariaDto } from "@/lib/coberturas";
import { formatarData } from "@/lib/formatacao";
import { Card } from "@/components/design/card";
import { Badge } from "@/components/badge";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { CriarCoberturaForm } from "./criar-cobertura-form";

// OS-pendentes-claude-code.md - "sem tela web pra configurar cobertura
// temporaria" (GET/POST /admin/coberturas ja existiam, OS-BACKEND-48).
// ApiKeyGuard-only (ver AdminCoberturasController) - mesmo padrao das
// outras telas /admin/*: adminApiFetch, role:'admin' controlado aqui.
export default async function AdminCoberturasPage() {
  const usuario = await exigirUsuarioAutenticado("/admin/coberturas");
  if (usuario.role !== "admin") {
    notFound();
  }

  let coberturas: CoberturaTemporariaDto[] = [];
  let vendedores: VendedorListaDto[] = [];
  let erro: string | null = null;

  try {
    [coberturas, vendedores] = await Promise.all([
      adminApiFetch<CoberturaTemporariaDto[]>("/admin/coberturas", { cache: "no-store" }),
      adminApiFetch<VendedorListaDto[]>("/admin/vendedores", { cache: "no-store" }),
    ]);
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Coberturas temporárias</h1>
      <p className="text-sm text-muted">
        Enquanto ativa, o vendedor substituto passa a enxergar também a carteira do vendedor
        original (ver escopo por hierarquia) e tem acesso ao resumo de handoff por cliente.
      </p>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : (
        <>
          <Card>
            <CriarCoberturaForm vendedores={vendedores} />
          </Card>

          {coberturas.length === 0 ? (
            <EstadoVazio mensagem="Nenhuma cobertura cadastrada ainda." />
          ) : (
            <div className="flex flex-col gap-3">
              {coberturas.map((cobertura) => (
                <Card key={cobertura.id}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="text-sm text-ink">
                      <span className="font-medium">{cobertura.vendedorSubstitutoNome ?? "—"}</span>{" "}
                      cobre{" "}
                      <span className="font-medium">{cobertura.vendedorOriginalNome ?? "—"}</span>
                    </p>
                    <Badge enfase={cobertura.ativa}>{cobertura.ativa ? "Ativa" : "Encerrada"}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {formatarData(cobertura.dataInicio)} até {formatarData(cobertura.dataFim)}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
