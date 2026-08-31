"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
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

export interface SecaoNavSidebar {
  titulo?: string;
  itens: ItemNavSidebar[];
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
  secoes,
  nomeUsuario,
}: {
  secoes: SecaoNavSidebar[];
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
        className={`flex h-screen flex-col border-r border-black/5 bg-surface transition-transform duration-200 ease-out ${
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

        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-6">
          {secoes.map((secao, indice) => (
            <div key={secao.titulo ?? indice} className="flex flex-col gap-1">
              {secao.titulo && (
                <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">
                  {secao.titulo}
                </p>
              )}
              {secao.itens.map((item) => {
                const ativo = pathname?.startsWith(item.href) ?? false;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                      ativo
                        ? "bg-primary-light font-medium text-primary"
                        : "text-muted hover:bg-background hover:text-ink"
                    }`}
                  >
                    <span className="shrink-0">{item.icone}</span>
                    <span className="flex-1 truncate">{item.rotulo}</span>
                    {item.badgeNovo ? (
                      <span className="rounded-full bg-accent-orange px-2 py-0.5 text-[10px] font-bold text-white">
                        NEW
                      </span>
                    ) : item.badge ? (
                      <span className="rounded-full bg-badge px-2 py-0.5 text-[10px] font-semibold text-muted">
                        {item.badge}
                      </span>
                    ) : null}
                    <IconeChevronDireita />
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-black/5 px-6 py-4 text-xs text-muted">
          Logado como <span className="font-medium text-ink">{nomeUsuario}</span>
        </div>
      </aside>
    </>
  );
}
