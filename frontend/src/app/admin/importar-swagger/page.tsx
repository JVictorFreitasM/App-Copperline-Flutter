import { notFound } from "next/navigation";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { ImportarSwaggerForm } from "./importar-swagger-form";

// Assistente de importação de endpoint via Swagger (OS-WEB-25) - UI pra
// POST /admin/endpoints/importar-swagger (OS-BACKEND-30). Mesmo critério
// de acesso das demais telas /admin/* (só role:'admin', ver
// admin/sincronizacao/page.tsx) - ApiKeyGuard no backend não distingue
// quem está por trás da chave, então o controle de quem chega até aqui é
// feito nesta página.
export default async function ImportarSwaggerPage() {
  const usuario = await exigirUsuarioAutenticado("/admin/importar-swagger");
  if (usuario.role !== "admin") {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Importar endpoint via Swagger</h1>
      <p className="text-sm text-muted">
        Gera um rascunho de model Prisma + SyncStrategy a partir de um endpoint do Swagger/OpenAPI
        do Radar. Nada é aplicado automaticamente — o resultado é sempre texto para revisão manual.
      </p>
      <ImportarSwaggerForm />
    </main>
  );
}
