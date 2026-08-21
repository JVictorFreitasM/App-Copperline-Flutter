import { exigirUsuarioAutenticado } from "@/lib/auth";
import { BuscaEstoque } from "./busca-estoque";

// Quarta tela de negocio (OS-WEB-14) - unica que nao e uma listagem
// paginada de dado sincronizado, e sim uma busca pontual em tempo real
// (endpoint on-demand da OS-BACKEND-12). Server Component so pra garantir
// autenticacao antes de renderizar (mesmo padrao das telas anteriores) - a
// interacao de busca em si vive no Client Component BuscaEstoque.
// `identificador` (query string) permite chegar aqui com um codigo ja
// preenchido - usado pelo atalho "Ver estoque" na tela de detalhe do
// produto, pra nao precisar digitar o codigo de novo.
export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ identificador?: string }>;
}) {
  await exigirUsuarioAutenticado("/estoque");

  const { identificador } = await searchParams;

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Consulta de estoque</h1>
      <BuscaEstoque identificadorInicial={identificador} />
    </main>
  );
}
