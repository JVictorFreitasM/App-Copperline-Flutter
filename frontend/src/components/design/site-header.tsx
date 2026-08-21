import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { resolverApiPublicUrl } from "@/lib/login-url";
import { SiteNav } from "./site-nav";

// Header raiz (OS-WEB-16) - existe em toda página (layout.tsx), navegação
// só aparece quando há sessão (nas páginas públicas, ex: "/", a própria
// página já resolve login/logout, não duplicar aqui). Server Component -
// só o SiteNav (destaque do item ativo) precisa ser Client.
export async function SiteHeader() {
  const user = await getCurrentUser();
  const apiPublicUrl = resolverApiPublicUrl();

  return (
    <header className="flex items-center justify-between gap-4 bg-surface px-6 py-4 shadow-sm">
      <Link href={user ? "/painel" : "/"} className="text-base font-bold text-ink">
        Copperline
      </Link>
      {user && <SiteNav />}
      {user && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted">{user.name}</span>
          <a
            href={`${apiPublicUrl}/auth/logout`}
            className="font-medium text-primary hover:underline"
          >
            Sair
          </a>
        </div>
      )}
    </header>
  );
}
