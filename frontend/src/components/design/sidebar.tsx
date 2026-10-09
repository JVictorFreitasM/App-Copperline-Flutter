"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { IconeChevronDireita, IconeMenu, IconePino } from "./icons";

const CHAVE_FIXADA = "sidebar_fixada";

// Estado "fixada" lido de localStorage via useSyncExternalStore (não
// useState+useEffect) - evita mismatch de hydration sem precisar de uma
// flag "pronta" extra: o React usa o snapshot de servidor (sempre `true`)
// durante a hydration e resincroniza com o valor real do navegador logo
// em seguida, do jeito recomendado pra ler uma fonte externa mutável.
const ouvintesFixada = new Set<() => void>();

function inscreverFixada(ouvinte: () => void) {
  ouvintesFixada.add(ouvinte);
  return () => ouvintesFixada.delete(ouvinte);
}

function lerFixada(): boolean {
  const salva = window.localStorage.getItem(CHAVE_FIXADA);
  return salva === null ? true : salva === "true";
}

function lerFixadaServidor(): boolean {
  return true;
}

function gravarFixada(valor: boolean) {
  window.localStorage.setItem(CHAVE_FIXADA, String(valor));
  ouvintesFixada.forEach((ouvinte) => ouvinte());
}

export interface ItemNavSidebar {
  href: string;
  rotulo: string;
  icone: ReactNode;
  // Contagem numérica (badge neutro) OU "NEW" (badge laranja) - nunca os
  // dois ao mesmo tempo, mesmo padrão da referência "Constructive" (cada
  // item da sidebar mostra no máximo um badge).
  badge?: string;
  badgeNovo?: boolean;
}

// Menu de primeiro nivel: ou um link direto (href) ou um grupo com submenu
// (itens) que abre ao passar o mouse (flyout ao lado da barra).
export interface MenuNavSidebar {
  rotulo: string;
  icone: ReactNode;
  href?: string;
  itens?: ItemNavSidebar[];
}

// Sidebar com dois modos (pedido explícito do usuário): FIXADA (parte do
// layout, empurra o conteúdo, sempre visível) ou RECOLHIDA (fora do fluxo,
// some da tela e reaparece como overlay ao encostar o mouse na borda
// esquerda, sem empurrar/redimensionar o conteúdo). Estado persistido em
// localStorage (conveniência por navegador, não por conta - mesmo critério
// de qualquer preferência puramente visual client-side do projeto) - lido
// só depois de montar (evita mismatch de hydration entre servidor e a
// preferência real salva no navegador).
//
// Visual: BRANCA (ver skill design-system - correção de uma versão
// anterior que usava sidebar escura, que não existe na referência
// "Constructive"). Separação do conteúdo vem só do fundo `background`
// cinza-azulado atrás da área principal, não de cor própria da sidebar.
export function Sidebar({
  menus,
  nomeUsuario,
}: {
  menus: MenuNavSidebar[];
  nomeUsuario: string;
}) {
  const pathname = usePathname();
  const fixada = useSyncExternalStore(inscreverFixada, lerFixada, lerFixadaServidor);
  const [sobreposta, setSobreposta] = useState(false);

  function alternarFixada() {
    const novoValor = !fixada;
    gravarFixada(novoValor);
    if (novoValor) {
      setSobreposta(false);
    }
  }

  const visivel = fixada || sobreposta;

  return (
    <>
      {/* Faixa de detecção (só existe quando recolhida) - encostar o mouse
          nos ~16px da borda esquerda revela a sidebar como overlay, sem
          precisar clicar em nada (critério de aceite explícito do pedido). */}
      {!fixada && (
        <div
          className="fixed top-0 left-0 z-40 h-full w-4"
          onMouseEnter={() => setSobreposta(true)}
        />
      )}

      <aside
        onMouseLeave={() => !fixada && setSobreposta(false)}
        className={`flex h-screen flex-col border-r border-ink/5 bg-surface transition-transform duration-200 ease-out ${
          fixada
            ? "sticky top-0 w-64 shrink-0"
            : `fixed top-0 left-0 z-40 w-64 shadow-2xl ${
                visivel ? "translate-x-0" : "-translate-x-full"
              }`
        }`}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <span className="text-lg font-bold text-ink">Copperline</span>
          <button
            type="button"
            onClick={alternarFixada}
            title={fixada ? "Deixar a barra recolhível" : "Fixar a barra sempre visível"}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-background hover:text-ink"
          >
            {fixada ? <IconePino /> : <IconeMenu />}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-6">
          {menus.map((menu) =>
            menu.itens ? (
              <GrupoMenu key={menu.rotulo} menu={menu} pathname={pathname ?? ""} />
            ) : (
              <LinkMenu key={menu.rotulo} menu={menu} ativo={menu.href ? (pathname?.startsWith(menu.href) ?? false) : false} />
            ),
          )}
        </nav>

        <div className="border-t border-ink/5 px-6 py-4 text-xs text-muted">
          Logado como <span className="font-medium text-ink">{nomeUsuario}</span>
        </div>
      </aside>
    </>
  );
}

const CLASSE_BASE_LINHA = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition";

function classeLinha(ativo: boolean, aberto = false) {
  if (ativo) return `${CLASSE_BASE_LINHA} bg-primary-light font-medium text-primary`;
  return `${CLASSE_BASE_LINHA} ${aberto ? "bg-background text-ink" : "text-muted hover:bg-background hover:text-ink"}`;
}

function LinkMenu({ menu, ativo }: { menu: MenuNavSidebar; ativo: boolean }) {
  return (
    <Link href={menu.href ?? "#"} className={classeLinha(ativo)}>
      <span className="shrink-0">{menu.icone}</span>
      <span className="flex-1 truncate">{menu.rotulo}</span>
    </Link>
  );
}

const LARGURA_BARRA_PX = 256; // w-64
const ALTURA_ITEM_PX = 44;

function Selos({ item }: { item: ItemNavSidebar }) {
  if (item.badgeNovo) {
    return (
      <span className="rounded-full bg-accent-orange px-2 py-0.5 text-[10px] font-bold text-white">NEW</span>
    );
  }
  if (item.badge) {
    return (
      <span className="rounded-full bg-badge px-2 py-0.5 text-[10px] font-semibold text-muted">{item.badge}</span>
    );
  }
  return null;
}

// Menu com submenu: o painel abre ao lado da barra quando o mouse passa (ou ao
// clicar/tocar e com Enter/Espaco), fica aberto enquanto o mouse estiver na linha
// OU no painel (pequeno atraso ao sair evita fechar no vao entre os dois) e fecha
// com Esc. Posicao `fixed` calculada pela linha do menu, ajustada pra nao sair
// da tela - o `nav` rola (overflow) e cortaria um painel absoluto.
function GrupoMenu({ menu, pathname }: { menu: MenuNavSidebar; pathname: string }) {
  const itens = menu.itens ?? [];
  const [aberto, setAberto] = useState(false);
  const [topo, setTopo] = useState(0);
  const linhaRef = useRef<HTMLButtonElement>(null);
  const timerFechar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const grupoAtivo = itens.some((item) => pathname.startsWith(item.href));

  function abrir() {
    if (timerFechar.current) clearTimeout(timerFechar.current);
    const retangulo = linhaRef.current?.getBoundingClientRect();
    if (retangulo) {
      const alturaPainel = itens.length * ALTURA_ITEM_PX + 56;
      setTopo(Math.max(8, Math.min(retangulo.top - 8, window.innerHeight - alturaPainel - 8)));
    }
    setAberto(true);
  }

  function agendarFechamento() {
    if (timerFechar.current) clearTimeout(timerFechar.current);
    timerFechar.current = setTimeout(() => setAberto(false), 150);
  }

  return (
    <div onMouseEnter={abrir} onMouseLeave={agendarFechamento} onKeyDown={(e) => e.key === "Escape" && setAberto(false)}>
      <button
        ref={linhaRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        className={classeLinha(grupoAtivo, aberto)}
      >
        <span className="shrink-0">{menu.icone}</span>
        <span className="flex-1 truncate text-left">{menu.rotulo}</span>
        <IconeChevronDireita />
      </button>

      {aberto && (
        <div
          role="menu"
          style={{ top: topo, left: LARGURA_BARRA_PX }}
          className="fixed z-50 w-64 rounded-card border border-ink/5 bg-surface p-2 shadow-2xl"
        >
          <p className="px-3 pt-1 pb-2 text-xs font-semibold tracking-wide text-muted uppercase">{menu.rotulo}</p>
          {itens.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setAberto(false)}
              className={classeLinha(pathname.startsWith(item.href))}
            >
              <span className="shrink-0">{item.icone}</span>
              <span className="flex-1 truncate">{item.rotulo}</span>
              <Selos item={item} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
