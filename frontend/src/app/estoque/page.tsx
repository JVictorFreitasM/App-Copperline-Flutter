import { exigirUsuarioAutenticado } from "@/lib/auth";
import { BuscaEstoque } from "./busca-estoque";

// Quarta tela de negocio (OS-WEB-14) - unica que nao e uma listagem
// paginada de dado sincronizado, e sim uma busca pontual em tempo real
// (endpoint on-demand da OS-BACKEND-12). Server Component so pra garantir
// autenticacao antes de renderizar (mesmo padrao das telas anteriores) - a
// interacao de busca em si vive no Client Component BuscaEstoque.
export default async function EstoquePage() {
  await exigirUsuarioAutenticado("/estoque");

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Consulta de estoque</h1>
      <BuscaEstoque />
    </main>
  );
}
