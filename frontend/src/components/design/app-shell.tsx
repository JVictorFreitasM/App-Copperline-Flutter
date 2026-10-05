import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { resolverApiPublicUrl } from "@/lib/login-url";
import type { MeuVendedorDto } from "@/lib/vendedores";
import {
  IconeBusca,
  IconeCamadas,
  IconeCaixa,
  IconeCalendario,
  IconeCheck,
  IconeClipboard,
  IconeEscudo,
  IconeGrade,
  IconeGrafico,
  IconeMapa,
  IconeMoeda,
  IconePessoas,
  IconeRecibo,
  IconeAtualizar,
  IconeUpload,
  IconeAlerta,
  IconeSino,
} from "./icons";
import { Sidebar, type SecaoNavSidebar } from "./sidebar";
import { Topbar } from "./topbar";

// Casca do app (sidebar + topbar, ver skill design-system - referência
// "Constructive") - substitui o antigo SiteHeader (barra superior única
// com nav horizontal). Mesma regra de visibilidade de antes: só aparece
// com sessão ativa (páginas públicas, ex: "/", renderizam sem casca - a
// própria página resolve login/logout). Server Component: só a Sidebar
// (pin/hover) é Client, todo o resto (dados de usuário/papel, montagem
// das seções de navegação) roda no servidor, mesmo critério de
// SiteHeader/SiteNav que este componente substitui.
export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    return <>{children}</>;
  }

  const apiPublicUrl = resolverApiPublicUrl();
  const podeAprovar = await apiFetch<MeuVendedorDto>("/vendedores/me", { cache: "no-store" })
    .then((meuVendedor) => meuVendedor.podeAprovar)
    .catch(() => false);

  const secoes: SecaoNavSidebar[] = [
    {
      itens: [
        { href: "/painel", rotulo: "Painel", icone: <IconeGrade /> },
        { href: "/clientes", rotulo: "Clientes", icone: <IconePessoas /> },
        { href: "/produtos", rotulo: "Produtos", icone: <IconeCaixa /> },
        { href: "/pedidos", rotulo: "Pedidos", icone: <IconeClipboard /> },
        { href: "/estoque", rotulo: "Estoque", icone: <IconeCamadas /> },
        { href: "/notas-fiscais", rotulo: "Notas fiscais", icone: <IconeRecibo /> },
        { href: "/consulta-cnpj", rotulo: "Consulta de CNPJ", icone: <IconeBusca /> },
        { href: "/tabelas-preco", rotulo: "Tabelas de preço", icone: <IconeMoeda /> },
        { href: "/metas", rotulo: "Metas e ranking", icone: <IconeGrafico /> },
        { href: "/oportunidades", rotulo: "Oportunidades", icone: <IconeAlerta /> },
        { href: "/coberturas", rotulo: "Cobertura temporária", icone: <IconePessoas /> },
        { href: "/agendamentos", rotulo: "Minha agenda", icone: <IconeCalendario /> },
        { href: "/notificacoes", rotulo: "Notificações", icone: <IconeSino /> },
      ],
    },
    ...(podeAprovar
      ? [
          {
            titulo: "Equipe",
            itens: [
              { href: "/aprovacoes", rotulo: "Aprovações", icone: <IconeCheck /> },
              { href: "/rastreio-equipe", rotulo: "Rastreio de equipe", icone: <IconeMapa /> },
              { href: "/admin/visitas", rotulo: "Visitas da equipe", icone: <IconeCalendario /> },
              {
                href: "/admin/agendamentos",
                rotulo: "Agendamentos da equipe",
                icone: <IconeCalendario />,
              },
              {
                href: "/admin/relatorio-pedidos",
                rotulo: "Relatório de pedidos",
                icone: <IconeGrafico />,
              },
            ],
          },
        ]
      : []),
    ...(user.role === "admin"
      ? [
          {
            titulo: "Administração",
            itens: [
              { href: "/admin/sincronizacao", rotulo: "Sincronização", icone: <IconeAtualizar /> },
              {
                href: "/admin/qualidade-dados",
                rotulo: "Qualidade de dados",
                icone: <IconeEscudo />,
              },
              { href: "/admin/vendedores", rotulo: "Vendedores", icone: <IconePessoas /> },
              {
                href: "/admin/tipos-acondicionamento",
                rotulo: "Tipos de acondicionamento",
                icone: <IconeCamadas />,
              },
              { href: "/admin/documentos", rotulo: "Documentos", icone: <IconeUpload /> },
              { href: "/admin/produtos", rotulo: "Produtos", icone: <IconeCaixa /> },
              {
                href: "/admin/pagamento",
                rotulo: "Forma e condição de pagamento",
                icone: <IconeMoeda />,
              },
              {
                href: "/admin/importar-swagger",
                rotulo: "Importar via Swagger",
                icone: <IconeUpload />,
              },
              { href: "/admin/metas", rotulo: "Metas e gamificação", icone: <IconeGrafico /> },
              { href: "/admin/coberturas", rotulo: "Coberturas temporárias", icone: <IconePessoas /> },
            ],
          },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar secoes={secoes} nomeUsuario={user.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          nomeUsuario={user.name}
          papel={user.role}
          linkSair={`${apiPublicUrl}/auth/logout`}
          mostrarConfiguracoes={user.role === "admin"}
        />
        {children}
      </div>
    </div>
  );
}
