import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { resolverApiPublicUrl } from "@/lib/login-url";
import type { MeuVendedorDto } from "@/lib/vendedores";
import { SiteNav } from "./site-nav";

// Header raiz (OS-WEB-16) - existe em toda página (layout.tsx), navegação
// só aparece quando há sessão (nas páginas públicas, ex: "/", a própria
// página já resolve login/logout, não duplicar aqui). Server Component -
// só o SiteNav (destaque do item ativo) precisa ser Client.
//
// GET /vendedores/me (OS-WEB-21) só pra decidir se mostra "Aprovações" no
// menu - mesmo padrão de getCurrentUser() já chamado aqui em toda página
// (mais uma consulta leve por request, não uma dependência nova). Falha
// silenciosa (podeAprovar: false) em vez de derrubar o header inteiro se
// a chamada falhar - não mostrar o link é degradação aceitável, quebrar a
// navegação do site inteiro não.
export async function SiteHeader() {
  const user = await getCurrentUser();
  const apiPublicUrl = resolverApiPublicUrl();
  const podeAprovar = user
    ? await apiFetch<MeuVendedorDto>("/vendedores/me", { cache: "no-store" })
        .then((meuVendedor) => meuVendedor.podeAprovar)
        .catch(() => false)
    : false;

  return (
    <header className="flex items-center justify-between gap-4 bg-surface px-6 py-4 shadow-sm">
      <Link href={user ? "/painel" : "/"} className="text-base font-bold text-ink">
        Copperline
      </Link>
      {user && <SiteNav role={user.role} podeAprovar={podeAprovar} />}
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
