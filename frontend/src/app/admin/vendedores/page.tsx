import { notFound } from "next/navigation";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { adminApiFetch } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { rotuloPapel, type VendedorListaDto } from "@/lib/vendedores";
import { Card } from "@/components/design/card";
import { Badge } from "@/components/badge";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { HierarquiaForm } from "./hierarquia-form";

// Gestão de hierarquia de vendedores (OS-WEB-21) - consome GET/PATCH
// admin/vendedores/* (o GET foi adicionado nesta OS, ver
// backend/src/vendedores/admin-vendedores.controller.ts - a OS-BACKEND-22
// só tinha o PATCH, sem lista pra popular a tela). Mesmo padrão das outras
// telas /admin/*: ApiKeyGuard no backend, chave só no servidor Next.js
// (adminApiFetch), role:'admin' controlado aqui (notFound() pros demais).
export default async function AdminVendedoresPage() {
  const usuario = await exigirUsuarioAutenticado("/admin/vendedores");
  if (usuario.role !== "admin") {
    notFound();
  }

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
                  <HierarquiaForm vendedor={vendedor} opcoesSupervisor={opcoesSupervisor} />
                </details>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
