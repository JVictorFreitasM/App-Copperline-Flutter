import Link from "next/link";
import type { ReactNode } from "react";

// Avatar/ícone circular à esquerda + título/subtítulo empilhados + valor à
// direita (às vezes com uma tag pequena abaixo) - ver skill design-system,
// "Item de lista". `href` torna a linha inteira clicável (Link), sem href
// vira um <div> estático (ex: linha que não navega a lugar nenhum).
interface ListItemProps {
  href?: string;
  avatar?: ReactNode;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  valor?: ReactNode;
  tag?: ReactNode;
}

export function ListItem({ href, avatar, titulo, subtitulo, valor, tag }: ListItemProps) {
  const conteudo = (
    <div className="flex items-center gap-4 rounded-card bg-surface p-4 shadow-sm transition hover:opacity-90">
      {avatar !== undefined && (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-semibold text-primary">
          {avatar}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{titulo}</p>
        {subtitulo && <p className="truncate text-xs text-muted">{subtitulo}</p>}
      </div>
      {(valor !== undefined || tag !== undefined) && (
        <div className="shrink-0 text-right">
          {valor !== undefined && <p className="text-sm font-medium text-ink">{valor}</p>}
          {tag !== undefined && <div className="mt-1">{tag}</div>}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {conteudo}
      </Link>
    );
  }
  return conteudo;
}
