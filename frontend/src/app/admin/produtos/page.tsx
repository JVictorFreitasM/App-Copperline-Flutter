import { notFound } from "next/navigation";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { UploadLoteForm } from "./upload-lote-form";

// Tela admin de catálogo de produtos (pedido do usuário, 2026-09-29) -
// hoje só a importação de imagens em massa; edição individual de
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
      <UploadLoteForm />
    </main>
  );
}
