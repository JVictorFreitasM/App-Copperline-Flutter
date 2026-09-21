"use client";

import { useEffect, useState } from "react";
import { IconeLua, IconeSol } from "./icons";

const CHAVE_TEMA = "copperline:tema";

// Toggle claro/escuro (ver skill design-system, "Tema escuro (toggle)") -
// aplica via atributo data-theme na tag <html> (globals.css define os
// tokens de cor pra cada valor) + persiste em localStorage. O valor
// inicial real (evitando flash de tema errado) é decidido por um script
// inline no <head> do layout, ANTES do React hidratar - este componente só
// lê o que já está aplicado no DOM ao montar, sem decidir o tema sozinho.
export function ThemeToggle() {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    setEscuro(document.documentElement.dataset.theme === "dark");
  }, []);

  function alternar() {
    const novoTema = escuro ? "light" : "dark";
    document.documentElement.dataset.theme = novoTema;
    try {
      window.localStorage.setItem(CHAVE_TEMA, novoTema);
    } catch {
      // Storage bloqueado (aba privada/política) - tema ainda funciona
      // nesta sessão, só não persiste pra próxima visita.
    }
    setEscuro(!escuro);
  }

  return (
    <button
      type="button"
      onClick={alternar}
      title={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-muted transition hover:text-ink"
      suppressHydrationWarning
    >
      {escuro ? <IconeSol /> : <IconeLua />}
    </button>
  );
}
