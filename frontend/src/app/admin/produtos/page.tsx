import { notFound } from "next/navigation";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { UploadIndividualForm } from "./upload-individual-form";
import { UploadLoteForm } from "./upload-lote-form";

// Tela admin de catálogo de produtos (pedido do usuário, 2026-09-29) -
// upload de imagem (em massa e individual, esta última movida de
// /produtos/[id] em 2026-09-29) centralizados aqui. Edição individual de
// precoFabricacao/tipoAcondicionamentoId continua na tela pública do
// produto (/produtos/[id]) por enquanto.
export default async function AdminProdutosPage() {
  const usuario = await exigirUsuarioAutenticado("/admin/produtos");
  if (usuario.role !== "admin") {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Produtos</h1>
      <UploadIndividualForm />
      <UploadLoteForm />
    </main>
  );
}
