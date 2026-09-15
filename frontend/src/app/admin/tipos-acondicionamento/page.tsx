import { notFound } from "next/navigation";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";
import type { TipoAcondicionamentoDto } from "@/lib/tipos-acondicionamento";
import { Card } from "@/components/design/card";
import { Badge } from "@/components/badge";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { AtivoToggle } from "./ativo-toggle";
import { CriarTipoForm } from "./criar-tipo-form";
import { TamanhoPadraoEditor } from "./tamanho-padrao-editor";

// Catálogo extensível de tipo de acondicionamento
// (OS-novas-implementacoes.md Bloco 4) - admin cadastra novos tipos sem
// precisar de deploy. Protegido por requireRole('admin') no backend
// (mesmo critério de /admin/produtos) - GET /admin/tipos-acondicionamento
// traz também os inativos (diferente do GET público, que só lista ativos
// pro seletor no formulário de produto).
export default async function AdminTiposAcondicionamentoPage() {
  const usuario = await exigirUsuarioAutenticado("/admin/tipos-acondicionamento");
  if (usuario.role !== "admin") {
    notFound();
  }

  let tipos: TipoAcondicionamentoDto[] = [];
  let erro: string | null = null;

  try {
    tipos = await apiFetch<TipoAcondicionamentoDto[]>("/admin/tipos-acondicionamento", {
      cache: "no-store",
    });
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Tipos de acondicionamento</h1>

      <Card>
        <CriarTipoForm />
      </Card>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : tipos.length === 0 ? (
        <EstadoVazio mensagem="Nenhum tipo de acondicionamento cadastrado ainda." />
      ) : (
        <div className="flex flex-col gap-3">
          {tipos.map((tipo) => (
            <Card key={tipo.id}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink">{tipo.nome}</p>
                  {!tipo.ativo && <Badge>Inativo</Badge>}
                  <Badge enfase={tipo.tamanhoPadrao !== null}>
                    {tipo.tamanhoPadrao !== null ? `Fixo (${tipo.tamanhoPadrao}m)` : "Retalho"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <TamanhoPadraoEditor tipoId={tipo.id} tamanhoPadraoInicial={tipo.tamanhoPadrao} />
                  <AtivoToggle tipoId={tipo.id} ativoInicial={tipo.ativo} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
