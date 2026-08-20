// Skeleton confirmado pela referência (não inventado, ver skill
// design-system, "Estado de loading"): mesma forma do conteúdo real
// (ListItem), preenchida com tom neutro (background), sem spinner. Usado
// nos loading.tsx de rota (Server Components suspendendo durante o fetch)
// e no estado `pending` da busca de estoque (Client Component).
export function LoadingSkeleton({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: linhas }).map((_, indice) => (
        <div
          key={indice}
          className="flex items-center gap-4 rounded-card bg-surface p-4 shadow-sm"
        >
          <span className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-background" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-background" />
            <div className="h-2 w-1/4 animate-pulse rounded-full bg-background" />
          </div>
          <div className="h-3 w-12 shrink-0 animate-pulse rounded-full bg-background" />
        </div>
      ))}
    </div>
  );
}
