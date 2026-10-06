"use client";

import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import iconeMarcador from "leaflet/dist/images/marker-icon.png";
import iconeMarcadorRetina from "leaflet/dist/images/marker-icon-2x.png";
import sombraMarcador from "leaflet/dist/images/marker-shadow.png";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

// Mesmo fix de ícones de app/rastreio-equipe/mapa-equipe.tsx (react-leaflet +
// bundler; Turbopack devolve a STRING do caminho, webpack clássico o objeto
// {src}) - sem isso o pino fica sem ícone ou o Leaflet lança "iconUrl not set".
function caminhoDoAsset(valor: string | { src: string }): string {
  return typeof valor === "string" ? valor : valor.src;
}

const iconePadrao = L.icon({
  iconUrl: caminhoDoAsset(iconeMarcador),
  iconRetinaUrl: caminhoDoAsset(iconeMarcadorRetina),
  shadowUrl: caminhoDoAsset(sombraMarcador),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = iconePadrao;

const CENTRO_PADRAO: [number, number] = [-14.235, -51.9253]; // centro geográfico do Brasil

function AoClicar({ onEscolher }: { onEscolher: (latitude: number, longitude: number) => void }) {
  useMapEvents({
    click(evento) {
      onEscolher(evento.latlng.lat, evento.latlng.lng);
    },
  });
  return null;
}

// Move a câmera quando o pino muda de fora (botão "Localizar") - o
// MapContainer só lê `center` na criação.
function Centralizar({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const mapa = useMap();
  useEffect(() => {
    if (latitude !== null && longitude !== null) {
      mapa.setView([latitude, longitude], Math.max(mapa.getZoom(), 16));
    }
  }, [mapa, latitude, longitude]);
  return null;
}

// Mapa do popup de endereço (Leaflet + OpenStreetMap - o mesmo das telas de
// rastreio e mapa de calor, sem chave de API): clique ou arraste o pino pra
// ajustar o ponto. Client Component importado com ssr:false pelo wrapper
// (Leaflet depende de `window`).
export function MapaEndereco({
  latitude,
  longitude,
  onEscolher,
}: {
  latitude: number | null;
  longitude: number | null;
  onEscolher: (latitude: number, longitude: number) => void;
}) {
  const temPino = latitude !== null && longitude !== null;
  const centro: [number, number] = temPino ? [latitude, longitude] : CENTRO_PADRAO;

  return (
    <MapContainer center={centro} zoom={temPino ? 16 : 4} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <AoClicar onEscolher={onEscolher} />
      <Centralizar latitude={latitude} longitude={longitude} />
      {temPino && (
        <Marker
          position={[latitude, longitude]}
          draggable
          eventHandlers={{
            dragend(evento) {
              const ponto = (evento.target as L.Marker).getLatLng();
              onEscolher(ponto.lat, ponto.lng);
            },
          }}
        />
      )}
    </MapContainer>
  );
}
