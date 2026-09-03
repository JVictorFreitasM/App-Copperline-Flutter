"use client";

import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet.heat";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { PontoMapaCalorVendasDto } from "@/lib/dashboard";

const CENTRO_PADRAO: [number, number] = [-14.235, -51.9253]; // centro geográfico do Brasil

// leaflet.heat não tem componente React próprio (API imperativa) -
// componente interno só pra ter acesso à instância do mapa via `useMap`
// (só funciona dentro do MapContainer) e desenhar/remover a camada.
function CamadaCalor({ pontos }: { pontos: PontoMapaCalorVendasDto[] }) {
  const mapa = useMap();

  useEffect(() => {
    // Intensidade normalizada pelo maior valorTotal do próprio conjunto de
    // pontos (mesmo raciocínio do GraficoRadar, OS-WEB-40: leaflet.heat
    // espera peso 0-1, não um valor absoluto em R$) - "intensidade reflete
    // o volume de vendas" (critério de aceite) fica relativo ao período/
    // seleção mostrada, não uma escala fixa arbitrária.
    const maximoValor = Math.max(1, ...pontos.map((ponto) => ponto.valorTotal));
    const pontosPeso: [number, number, number][] = pontos.map((ponto) => [
      ponto.latitude,
      ponto.longitude,
      ponto.valorTotal / maximoValor,
    ]);
    const camada = L.heatLayer(pontosPeso, { radius: 30, blur: 20, maxZoom: 12 });
    camada.addTo(mapa);
    return () => {
      camada.remove();
    };
  }, [mapa, pontos]);

  return null;
}

// Mapa de calor de vendas por região (OS-WEB-39) - mesma base de mapa das
// OS-WEB-24/32 (Leaflet + OpenStreetMap, ver mapa-equipe.tsx), trocando a
// camada de marcadores/trajeto pela camada de calor. Client Component
// importado via next/dynamic com ssr:false pelo pai (Leaflet depende de
// `window`).
export function MapaCalorVendas({ pontos }: { pontos: PontoMapaCalorVendasDto[] }) {
  const centro: [number, number] =
    pontos.length > 0 ? [pontos[0].latitude, pontos[0].longitude] : CENTRO_PADRAO;

  return (
    <MapContainer center={centro} zoom={pontos.length > 0 ? 6 : 4} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CamadaCalor pontos={pontos} />
    </MapContainer>
  );
}
