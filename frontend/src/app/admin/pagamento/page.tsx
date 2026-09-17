import { notFound } from "next/navigation";
import { exigirUsuarioAutenticado } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";
import type { AdminCondicaoPagamentoDto, AdminFormaPagamentoDto } from "@/lib/pagamento";
import { Card } from "@/components/design/card";
import { Badge } from "@/components/badge";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { PagamentoAtivoToggle } from "./pagamento-ativo-toggle";

// Painel pra ativar/desativar forma/condição de pagamento (pedido do
// usuário, 2026-09-16/17) - catálogos sincronizados do WK Radar (ver
// sync/strategies/forma-pagamento.sync.ts/condicao-pagamento.sync.ts),
// mas o toggle aqui grava só `desativadaManualmente` (campo local, nunca
// sobrescrito pelo sync diário - ver schema.prisma). Protegido por
// requireRole('admin') no backend, mesmo critério das outras telas admin.
export default async function AdminPagamentoPage() {
  const usuario = await exigirUsuarioAutenticado("/admin/pagamento");
  if (usuario.role !== "admin") {
    notFound();
  }

  let formas: AdminFormaPagamentoDto[] = [];
  let condicoes: AdminCondicaoPagamentoDto[] = [];
  let erro: string | null = null;

  try {
    [formas, condicoes] = await Promise.all([
      apiFetch<AdminFormaPagamentoDto[]>("/admin/formas-pagamento", { cache: "no-store" }),
      apiFetch<AdminCondicaoPagamentoDto[]>("/admin/condicoes-pagamento", { cache: "no-store" }),
    ]);
  } catch (error) {
    erro = error instanceof ApiError ? error.message : "Erro desconhecido ao consultar a API.";
  }

  if (erro) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-8">
        <h1 className="text-2xl font-bold text-ink">Forma e condição de pagamento</h1>
        <ErroConexao mensagem={erro} />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Forma e condição de pagamento</h1>
      <p className="text-sm text-muted">
        Controla quais opções aparecem pra escolha na criação de pedido (web e mobile). Desativar
        aqui não afeta o cadastro no WK Radar - só impede a seleção nesse sistema.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Formas de pagamento</h2>
        {formas.length === 0 ? (
          <EstadoVazio mensagem="Nenhuma forma de pagamento sincronizada ainda." />
        ) : (
          <div className="flex flex-col gap-3">
            {formas.map((forma) => (
              <Card key={forma.id}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink">
                      {forma.descricao ?? forma.codigo ?? forma.id}
                    </p>
                    {forma.inativaNoErp && <Badge>Inativa no Radar</Badge>}
                  </div>
                  <PagamentoAtivoToggle
                    id={forma.id}
                    tipo="forma"
                    permitidoInicial={!forma.desativadaManualmente}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Condições de pagamento</h2>
        {condicoes.length === 0 ? (
          <EstadoVazio mensagem="Nenhuma condição de pagamento sincronizada ainda." />
        ) : (
          <div className="flex flex-col gap-3">
            {condicoes.map((condicao) => (
              <Card key={condicao.id}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink">
                      {condicao.nome ?? condicao.codigo ?? condicao.id}
                    </p>
                    {condicao.expirada && <Badge>Expirada</Badge>}
                  </div>
                  <PagamentoAtivoToggle
                    id={condicao.id}
                    tipo="condicao"
                    permitidoInicial={!condicao.desativadaManualmente}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
