import { notFound } from "next/navigation";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";
import type {
  AlcadaAprovacaoDto,
  ConfiguracaoOrcamentoDto,
  ConfiguracaoRastreioDto,
} from "@/lib/configuracoes";
import { ErroConexao } from "@/components/listagem-feedback";
import { ConfiguracoesTabs } from "./configuracoes-tabs";

// Tela de Configurações (Épico 4, OS-dashboard-configuracoes-
// notificacoes-auditoria.md) - ícone de acesso na Topbar, ao lado do sino
// de notificações. Protegido por requireRole('admin') no backend (mesmo
// critério de admin/tipos-acondicionamento) - segue o mesmo padrão de
// checagem aqui (notFound() pra quem não é admin).
export default async function ConfiguracoesPage() {
  const usuario = await exigirUsuarioAutenticado("/configuracoes");
  if (usuario.role !== "admin") {
    notFound();
  }

  try {
    const [alcada, orcamento, rastreio] = await Promise.all([
      apiFetch<AlcadaAprovacaoDto>("/admin/configuracoes/alcada-aprovacao", { cache: "no-store" }),
      apiFetch<ConfiguracaoOrcamentoDto>("/admin/configuracoes/orcamento", { cache: "no-store" }),
      apiFetch<ConfiguracaoRastreioDto>("/admin/configuracoes/rastreio", { cache: "no-store" }),
    ]);

    return (
      <main className="flex flex-1 flex-col gap-6 p-8">
        <h1 className="text-2xl font-bold text-ink">Configurações</h1>
        <ConfiguracoesTabs
          alcadaInicial={alcada}
          orcamentoInicial={orcamento}
          rastreioInicial={rastreio}
        />
      </main>
    );
  } catch (error) {
    const mensagem = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
    return (
      <main className="flex flex-1 flex-col gap-6 p-8">
        <h1 className="text-2xl font-bold text-ink">Configurações</h1>
        <ErroConexao mensagem={mensagem} />
      </main>
    );
  }
}
