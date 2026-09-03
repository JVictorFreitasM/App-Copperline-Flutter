"use client";

import dynamic from "next/dynamic";
import type { PontoMapaCalorVendasDto } from "@/lib/dashboard";
import { LoadingSkeleton } from "@/components/design/loading-skeleton";

// ssr:false só é permitido dentro de um Client Component (ver mesmo
// padrão em app/rastreio-equipe/painel-rastreio-equipe.tsx) - Leaflet
// acessa `window` na inicialização, e painel/page.tsx (o chamador) é
// Server Component.
const MapaCalorVendas = dynamic(
  () => import("./mapa-calor-vendas").then((mod) => mod.MapaCalorVendas),
  { ssr: false, loading: () => <LoadingSkeleton linhas={1} /> },
);

export function MapaCalorVendasWrapper({ pontos }: { pontos: PontoMapaCalorVendasDto[] }) {
  return <MapaCalorVendas pontos={pontos} />;
}
