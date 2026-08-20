import { LoadingSkeleton } from "@/components/design/loading-skeleton";

// Convenção de rota do Next.js - ver clientes/loading.tsx.
export default function ProdutosLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">Produtos</h1>
      <LoadingSkeleton />
    </main>
  );
}
