import { LoadingSkeleton } from "@/components/design/loading-skeleton";

// Convenção de rota do Next.js - mostrado automaticamente enquanto a
// page.tsx (Server Component) busca dados. Skeleton confirmado pela
// referência (ver skill design-system, "Estado de loading").
export default function ClientesLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Clientes</h1>
      <LoadingSkeleton />
    </main>
  );
}
