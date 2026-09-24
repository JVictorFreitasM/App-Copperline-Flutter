import Form from "next/form";
import Link from "next/link";
import { IconeBusca, IconeEngrenagem } from "./icons";
import { NotificacaoSino } from "./notificacao-sino";
import { ThemeToggle } from "./theme-toggle";

// Barra superior (ver skill design-system, "Aplicação no Web - casca do
// app") - busca global (GET /busca, OS-BACKEND-18 - ficou só visual/
// `disabled` por um bom tempo até a tela de resultado, /busca, existir) +
// notificações (Épico 5 - NotificacaoSino, Client Component isolado, ver
// seu comentário) + configurações (Épico 4, OS-dashboard-configuracoes-
// notificacoes-auditoria.md - só pra quem é admin, mesmo critério de
// "Administração" na Sidebar) + usuário/sair. Server Component pro resto
// (só Link/texto) - next/form (mesmo padrão de FiltroForm) reflete a busca
// na URL sem precisar de nenhum JS no cliente.
export function Topbar({
  nomeUsuario,
  papel,
  linkSair,
  mostrarConfiguracoes = false,
}: {
  nomeUsuario: string;
  papel: string | null;
  linkSair: string;
  mostrarConfiguracoes?: boolean;
}) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-ink/5 bg-surface px-8 py-4">
      <Form action="/busca" className="w-full max-w-sm">
        <label className="flex items-center gap-2 rounded-full bg-background px-4 py-2.5 text-sm text-muted">
          <IconeBusca />
          <input
            type="search"
            name="q"
            placeholder="Buscar cliente, produto ou pedido..."
            className="w-full bg-transparent text-ink outline-none placeholder:text-muted"
          />
        </label>
      </Form>

      <div className="flex items-center gap-4">
        <ThemeToggle />
        {mostrarConfiguracoes && (
          <Link
            href="/configuracoes"
            title="Configurações"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-muted transition hover:text-ink"
          >
            <IconeEngrenagem />
          </Link>
        )}
        <NotificacaoSino />
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-sm font-semibold text-primary">
            {nomeUsuario.charAt(0).toUpperCase()}
          </span>
          <div className="text-left leading-tight">
            <p className="text-sm font-medium text-ink">{nomeUsuario}</p>
            {papel && <p className="text-xs text-muted capitalize">{papel}</p>}
          </div>
        </div>
        <a href={linkSair} className="text-sm font-medium text-primary hover:underline">
          Sair
        </a>
      </div>
    </header>
  );
}
