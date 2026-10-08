import Link from "next/link";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { obterFuncionalidades } from "@/lib/funcionalidades";
import { FormularioNovoCliente } from "./formulario-novo-cliente";

// Cadastro de cliente novo. Server Component só pra garantir autenticação
// antes de renderizar - o formulário todo vive no Client Component (estado de
// interação: consulta do documento, popups de endereço e contato).
export default async function NovoClientePage() {
  await exigirUsuarioAutenticado("/clientes/novo");
  const { cadastroClientesHabilitado } = await obterFuncionalidades();

  if (!cadastroClientesHabilitado) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-8">
        <h1 className="text-2xl font-bold text-ink">Novo cliente</h1>
        <p className="text-sm text-ink">
          O cadastro de clientes está desativado no momento. Fale com o administrador.
        </p>
        <Link href="/clientes" className="text-sm font-medium text-primary hover:underline">
          ← Voltar para clientes
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Novo cliente</h1>
      <FormularioNovoCliente />
    </main>
  );
}
