"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Navegação do layout raiz, padrão web (superior) da skill design-system -
// não a navegação inferior do padrão mobile. Item ativo em `ink`
// (peso maior), inativos em `muted` - sem indicador extra além disso (ver
// skill, "Navegação inferior (mobile) / lateral ou superior (web)").
// Client Component só por causa do usePathname() (destaque do item ativo)
// - o resto do header (SiteHeader) continua Server Component.
const ITENS_BASE = [
  { href: "/painel", rotulo: "Painel" },
  { href: "/clientes", rotulo: "Clientes" },
  { href: "/produtos", rotulo: "Produtos" },
  { href: "/pedidos", rotulo: "Pedidos" },
  { href: "/estoque", rotulo: "Estoque" },
  { href: "/notas-fiscais", rotulo: "Notas fiscais" },
];

// "Sincronização" só aparece pra role:'admin' (OS-WEB-18) - a página em si
// já nega acesso a quem não é admin (notFound(), ver
// admin/sincronizacao/page.tsx), isso aqui é só não oferecer o link a quem
// não vai conseguir usá-lo.
export function SiteNav({ role }: { role: string | null }) {
  const pathname = usePathname();
  const itens =
    role === "admin"
      ? [...ITENS_BASE, { href: "/admin/sincronizacao", rotulo: "Sincronização" }]
      : ITENS_BASE;

  return (
    <nav className="flex items-center gap-1">
      {itens.map((item) => {
        const ativo = pathname?.startsWith(item.href) ?? false;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-4 py-2 text-sm transition ${
              ativo ? "font-semibold text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
