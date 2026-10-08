import { notFound } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import type { ContaAcessoDto } from "@/lib/acessos";
import { ErroConexao } from "@/components/listagem-feedback";
import { ListaContas } from "./lista-contas";

// Acessos (admin): todas as contas com os celulares/navegadores logados agora,
// e o bloqueio de conta / encerramento de sessão. Vale só para o App Copperline
// (não altera o IdP). Protegido por requireRole('admin') no backend.
export default async function AcessosPage() {
  const usuario = await exigirUsuarioAutenticado("/admin/acessos");
  if (usuario.role !== "admin") notFound();

  let contas: ContaAcessoDto[] | null = null;
  let erro: string | null = null;
  try {
    contas = await apiFetch<ContaAcessoDto[]>("/admin/acessos", { cache: "no-store" });
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Acessos</h1>
        <p className="mt-1 text-sm text-muted">
          Contas e aparelhos conectados ao App Copperline. Bloquear uma conta derruba todas as sessões dela e
          impede novo acesso a este sistema (os outros sistemas da empresa não são afetados).
        </p>
      </div>
      {erro ? <ErroConexao mensagem={erro} /> : <ListaContas contas={contas ?? []} meuEmail={usuario.email} />}
    </main>
  );
}
