"use client";

import dynamic from "next/dynamic";
import { LoadingSkeleton } from "@/components/design/loading-skeleton";

// ssr:false só é permitido dentro de um Client Component (mesmo padrão de
// components/design/mapa-calor-vendas-wrapper.tsx) - Leaflet acessa `window`
// na inicialização.
const MapaEndereco = dynamic(() => import("./mapa-endereco").then((mod) => mod.MapaEndereco), {
  ssr: false,
  loading: () => <LoadingSkeleton linhas={1} />,
});

export function MapaEnderecoWrapper(props: {
  latitude: number | null;
  longitude: number | null;
  onEscolher: (latitude: number, longitude: number) => void;
}) {
  return <MapaEndereco {...props} />;
}
