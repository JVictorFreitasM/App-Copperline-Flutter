import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { TipoAcondicionamentoDto } from "@/lib/tipos-acondicionamento";
import { DadosAdministrativosProduto } from "./dados-administrativos-produto";
import { UploadLoteForm } from "./upload-lote-form";

// Tela admin de catálogo de produtos (pedido do usuário, 2026-09-29) -
// "Dados administrativos" (preço de fabricação, tipo de acondicionamento,
// imagem - nenhum vem do WK Radar) inteiro movido de /produtos/[id] pra
// cá, junto do upload de imagem em massa.
export default async function AdminProdutosPage() {
  const usuario = await exigirUsuarioAutenticado("/admin/produtos");
  if (usuario.role !== "admin") {
    notFound();
  }

  let tiposAcondicionamento: TipoAcondicionamentoDto[] = [];
  try {
    tiposAcondicionamento = await apiFetch<TipoAcondicionamentoDto[]>("/tipos-acondicionamento", {
      cache: "no-store",
    });
  } catch {
    // Falha aqui nao derruba a tela inteira - so o seletor de tipo de
    // acondicionamento fica sem opcoes (usuario ve erro claro se tentar
    // salvar mesmo assim).
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Produtos</h1>
      <DadosAdministrativosProduto tiposAcondicionamento={tiposAcondicionamento} />
      <UploadLoteForm />
    </main>
  );
}
