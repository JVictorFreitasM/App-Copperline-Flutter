import { notFound } from "next/navigation";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { adminApiFetch } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { OPCOES_PAPEL, rotuloPapel, type VendedorListaDto } from "@/lib/vendedores";
import { Card } from "@/components/design/card";
import { PrimaryButton } from "@/components/design/button";
import { Badge } from "@/components/badge";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { atualizarHierarquia } from "./actions";

// Gestão de hierarquia de vendedores (OS-WEB-21) - consome GET/PATCH
// admin/vendedores/* (o GET foi adicionado nesta OS, ver
// backend/src/vendedores/admin-vendedores.controller.ts - a OS-BACKEND-22
// só tinha o PATCH, sem lista pra popular a tela). Mesmo padrão das outras
// telas /admin/*: ApiKeyGuard no backend, chave só no servidor Next.js
// (adminApiFetch), role:'admin' controlado aqui (notFound() pros demais).
export default async function AdminVendedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
}) {
  const usuario = await exigirUsuarioAutenticado("/admin/vendedores");
  if (usuario.role !== "admin") {
    notFound();
  }

  const { erro: erroQuery, sucesso } = await searchParams;

  let vendedores: VendedorListaDto[] = [];
  let erro: string | null = null;

  try {
    vendedores = await adminApiFetch<VendedorListaDto[]>("/admin/vendedores", {
      cache: "no-store",
    });
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Hierarquia de vendedores</h1>

      {erroQuery && <ErroConexao mensagem={decodeURIComponent(erroQuery)} />}
      {sucesso && (
        <Card>
          <p className="text-sm font-medium text-ink">{decodeURIComponent(sucesso)}</p>
        </Card>
      )}

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : vendedores.length === 0 ? (
        <EstadoVazio mensagem="Nenhum vendedor sincronizado ainda." />
      ) : (
        <div className="flex flex-col gap-3">
          {vendedores.map((vendedor) => {
            // Supervisor não pode ser o próprio vendedor - excluído das
            // opções (o backend também rejeita isso e qualquer ciclo, mas
            // não faz sentido nem oferecer a opção na tela).
            const opcoesSupervisor = vendedores.filter((v) => v.id !== vendedor.id);

            return (
              <Card key={vendedor.id}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {vendedor.nome ?? "Vendedor sem nome"}
                    </p>
                    <p className="text-xs text-muted">
                      {vendedor.email ?? "sem e-mail"} · reporta para{" "}
                      {vendedor.supervisorNome ?? "ninguém"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge enfase>{rotuloPapel(vendedor.papel)}</Badge>
                    {vendedor.inativo && <Badge>Inativo</Badge>}
                  </div>
                </div>

                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-primary">
                    Editar papel/supervisor
                  </summary>
                  <form
                    action={atualizarHierarquia.bind(null, vendedor.id)}
                    className="mt-3 flex flex-wrap items-end gap-3 rounded-card bg-background p-4"
                  >
                    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                      Papel
                      <select
                        name="papel"
                        defaultValue={vendedor.papel}
                        className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                      >
                        {OPCOES_PAPEL.map((opcao) => (
                          <option key={opcao.valor} value={opcao.valor}>
                            {opcao.rotulo}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                      Supervisor
                      <select
                        name="supervisorId"
                        defaultValue={vendedor.supervisorId ?? ""}
                        className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
                      >
                        <option value="">Nenhum</option>
                        {opcoesSupervisor.map((opcao) => (
                          <option key={opcao.id} value={opcao.id}>
                            {opcao.nome ?? opcao.id} ({rotuloPapel(opcao.papel)})
                          </option>
                        ))}
                      </select>
                    </label>
                    <PrimaryButton type="submit">Salvar</PrimaryButton>
                  </form>
                </details>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
