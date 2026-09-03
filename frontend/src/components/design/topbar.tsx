import Form from "next/form";
import { IconeBusca, IconeSino } from "./icons";

// Barra superior (ver skill design-system, "Aplicação no Web - casca do
// app") - busca global (GET /busca, OS-BACKEND-18 - ficou só visual/
// `disabled` por um bom tempo até a tela de resultado, /busca, existir) +
// notificações (visual, sem sistema de notificação in-app no web ainda) +
// usuário/sair. Server Component (só Link/texto) - next/form (mesmo
// padrão de FiltroForm) reflete a busca na URL sem precisar de nenhum JS
// no cliente, então a Topbar continua sem virar Client Component só por
// causa disso.
export function Topbar({
  nomeUsuario,
  papel,
  linkSair,
}: {
  nomeUsuario: string;
  papel: string | null;
  linkSair: string;
}) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-black/5 bg-surface px-8 py-4">
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
        <button
          type="button"
          title="Notificações"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-muted transition hover:text-ink"
        >
          <IconeSino />
        </button>
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
