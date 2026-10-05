import { exigirUsuarioAutenticado } from "@/lib/auth";
import { BuscaCnpj } from "./busca-cnpj";

// Consulta de dados cadastrais de empresa por CNPJ (Receita Federal). Server
// Component só pra garantir autenticação antes de renderizar - a interação
// vive no Client Component BuscaCnpj (mesmo padrão de /estoque).
export default async function ConsultaCnpjPage() {
  await exigirUsuarioAutenticado("/consulta-cnpj");

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Consulta de CNPJ</h1>
      <BuscaCnpj />
    </main>
  );
}
