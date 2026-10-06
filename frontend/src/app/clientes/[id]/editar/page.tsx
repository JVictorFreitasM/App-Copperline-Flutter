import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { ClienteEdicaoDto } from "@/lib/cadastro-cliente";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { FormularioEditarCliente } from "./formulario-editar-cliente";

// Edição de cliente. Server Component só pra autenticar e buscar os dados do
// formulário (GET /clientes/:id/edicao - mesmo escopo por vendedor do
// detalhe); o formulário vive no Client Component.
export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await exigirUsuarioAutenticado(`/clientes/${id}/editar`);

  let cliente: ClienteEdicaoDto | null = null;
  let naoEncontrado = false;
  let erro: string | null = null;
  try {
    cliente = await apiFetch<ClienteEdicaoDto>(`/clientes/${encodeURIComponent(id)}/edicao`, {
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      naoEncontrado = true;
    } else {
      erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <Link href={`/clientes/${encodeURIComponent(id)}`} className="text-sm font-medium text-primary hover:underline">
        ← Voltar para o cliente
      </Link>
      <h1 className="text-2xl font-bold text-ink">Editar cliente</h1>
      {erro ? (
        <ErroConexao mensagem={erro} />
      ) : naoEncontrado ? (
        <EstadoVazio mensagem={`Cliente '${id}' não encontrado.`} />
      ) : (
        cliente && <FormularioEditarCliente cliente={cliente} />
      )}
    </main>
  );
}
