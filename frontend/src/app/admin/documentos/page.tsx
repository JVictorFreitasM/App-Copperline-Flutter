import { notFound } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { formatarTamanhoArquivo, type DocumentoDto } from "@/lib/documentos";
import type { PaginatedResult } from "@/lib/pagination";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { Paginacao } from "@/components/paginacao";
import { Card } from "@/components/design/card";
import { Badge } from "@/components/badge";
import { FiltroForm, CampoFiltro } from "@/components/filtro";
import { UploadDocumentoForm } from "./upload-form";
import { RemoverDocumentoForm } from "./remover-documento-form";

const LIMITE_POR_PAGINA = 20;

// Painel de gestão de documentos institucionais (OS-WEB-38) - contraparte
// admin da OS-MOBILE-34 (consulta no app). Consome os endpoints da
// OS-BACKEND-41 (upload/listar/baixar) + a extensão de remoção adicionada
// junto com esta OS (POST/GET/DELETE de admin/documentos). Mesmo critério
// de acesso das demais telas /admin/* - só role:'admin' (ver
// admin/sincronizacao/page.tsx), aqui via requireAuth+requireRole('admin')
// do próprio backend (sessão SSO, não ApiKeyGuard - ver
// admin-documentos.controller.ts).
export default async function DocumentosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; categoria?: string }>;
}) {
  const usuario = await exigirUsuarioAutenticado("/admin/documentos");
  if (usuario.role !== "admin") {
    notFound();
  }

  const params = await searchParams;
  const paginaParam = Number(params.page);
  const pagina = Number.isInteger(paginaParam) && paginaParam > 0 ? paginaParam : 1;
  const categoria = params.categoria?.trim() || undefined;

  let resultado: PaginatedResult<DocumentoDto> | null = null;
  let erro: string | null = null;

  try {
    const query = new URLSearchParams({
      page: String(pagina),
      limit: String(LIMITE_POR_PAGINA),
      ...(categoria && { categoria }),
    });
    resultado = await apiFetch<PaginatedResult<DocumentoDto>>(`/documentos?${query}`, {
      cache: "no-store",
    });
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Documentos</h1>
      <p className="text-sm text-muted">
        Tabelas, catálogos e políticas comerciais disponibilizados aos vendedores no app.
      </p>

      <UploadDocumentoForm />

      <FiltroForm rota="/admin/documentos">
        <CampoFiltro label="Categoria" name="categoria" defaultValue={categoria} />
      </FiltroForm>

      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : resultado && resultado.data.length === 0 ? (
        <EstadoVazio mensagem="Nenhum documento enviado ainda." />
      ) : (
        resultado && (
          <>
            <div className="flex flex-col gap-3">
              {resultado.data.map((documento) => (
                <Card key={documento.id} className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <a
                      href={`/admin/documentos/${documento.id}/download`}
                      className="truncate text-sm font-medium text-ink hover:underline"
                    >
                      {documento.nome}
                    </a>
                    <p className="mt-1 truncate text-xs text-muted">
                      {formatarTamanhoArquivo(documento.tamanhoBytes)} · Enviado por{" "}
                      {documento.enviadoPor} em{" "}
                      {new Date(documento.criadoEm).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Badge>{documento.categoria}</Badge>
                  <RemoverDocumentoForm id={documento.id} />
                </Card>
              ))}
            </div>

            <Paginacao
              rota="/admin/documentos"
              pagina={resultado.meta.page}
              totalPaginas={resultado.meta.totalPages}
              filtros={{ categoria }}
            />
          </>
        )
      )}
    </main>
  );
}
