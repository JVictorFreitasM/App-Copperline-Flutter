import Link from "next/link";

// Paginação genérica por query string (?page=N) - compartilhada por
// qualquer tela de listagem paginada (clientes, produtos, ...). Recebe a
// base da rota (ex: "/clientes") pra montar os links, sem acoplar a
// nenhuma tela especifica. `filtros` (adicionado na OS-WEB-15) preserva
// qualquer filtro ativo ao trocar de página - sem isso, ir pra página 2
// perderia o filtro aplicado. Pill em `surface`/`ink` (OS-WEB-16) - mesmo
// raio/sombra do SecondaryButton, mas com estado desabilitado (link comum
// não tem isso, por isso não reaproveita o componente Button aqui.
export function Paginacao({
  rota,
  pagina,
  totalPaginas,
  filtros,
}: {
  rota: string;
  pagina: number;
  totalPaginas: number;
  filtros?: Record<string, string | undefined>;
}) {
  if (totalPaginas <= 1) {
    return null;
  }

  const construirHref = (paginaAlvo: number) => {
    const params = new URLSearchParams();
    for (const [chave, valor] of Object.entries(filtros ?? {})) {
      if (valor) {
        params.set(chave, valor);
      }
    }
    params.set("page", String(paginaAlvo));
    return `${rota}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between text-sm text-muted">
      <Link
        href={construirHref(pagina - 1)}
        aria-disabled={pagina <= 1}
        className={`rounded-full bg-surface px-4 py-2 font-medium text-ink shadow-sm ${
          pagina <= 1 ? "pointer-events-none opacity-40" : "hover:opacity-80"
        }`}
      >
        Anterior
      </Link>
      <span>
        Página {pagina} de {totalPaginas}
      </span>
      <Link
        href={construirHref(pagina + 1)}
        aria-disabled={pagina >= totalPaginas}
        className={`rounded-full bg-surface px-4 py-2 font-medium text-ink shadow-sm ${
          pagina >= totalPaginas ? "pointer-events-none opacity-40" : "hover:opacity-80"
        }`}
      >
        Próxima
      </Link>
    </div>
  );
}
