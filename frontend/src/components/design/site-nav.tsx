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

// "Sincronização"/"Qualidade de dados" só aparecem pra role:'admin'
// (OS-WEB-18/OS-WEB-20) - a página em si já nega acesso a quem não é admin
// (notFound(), ver admin/sincronizacao/page.tsx e
// admin/qualidade-dados/page.tsx), isso aqui é só não oferecer o link a
// quem não vai conseguir usá-lo.
const ITENS_ADMIN = [
  { href: "/admin/sincronizacao", rotulo: "Sincronização" },
  { href: "/admin/qualidade-dados", rotulo: "Qualidade de dados" },
  { href: "/admin/vendedores", rotulo: "Vendedores" },
];

// "Aprovações" (OS-WEB-21), "Rastreio de equipe" (OS-WEB-24) e "Visitas da
// equipe" (OS-WEB-26, rota /admin/visitas apesar do prefixo - critério de
// acesso é PapelVendedor, não role:'admin' do IdP) seguem um critério
// diferente dos itens /admin/* de verdade acima: `podeAprovar` (resolvido
// no backend via GET /vendedores/me - PapelVendedor SUPERVISOR/GERENTE, ou
// admin) - a MESMA elegibilidade das três telas (quem supervisiona a
// equipe em uma supervisiona nas outras).
export function SiteNav({
  role,
  podeAprovar,
}: {
  role: string | null;
  podeAprovar: boolean;
}) {
  const pathname = usePathname();
  const itens = [
    ...ITENS_BASE,
    ...(podeAprovar
      ? [
          { href: "/aprovacoes", rotulo: "Aprovações" },
          { href: "/rastreio-equipe", rotulo: "Rastreio de equipe" },
          { href: "/admin/visitas", rotulo: "Visitas da equipe" },
        ]
      : []),
    ...(role === "admin" ? ITENS_ADMIN : []),
  ];

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
