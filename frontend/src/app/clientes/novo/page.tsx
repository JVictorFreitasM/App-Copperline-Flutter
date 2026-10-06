import { exigirUsuarioAutenticado } from "@/lib/auth";
import { FormularioNovoCliente } from "./formulario-novo-cliente";

// Cadastro de cliente novo. Server Component só pra garantir autenticação
// antes de renderizar - o formulário todo vive no Client Component (estado de
// interação: consulta do documento, popups de endereço e contato).
export default async function NovoClientePage() {
  await exigirUsuarioAutenticado("/clientes/novo");

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Novo cliente</h1>
      <FormularioNovoCliente />
    </main>
  );
}
