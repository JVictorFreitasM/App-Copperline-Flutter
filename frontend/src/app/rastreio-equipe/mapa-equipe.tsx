"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import iconeMarcador from "leaflet/dist/images/marker-icon.png";
import iconeMarcadorRetina from "leaflet/dist/images/marker-icon-2x.png";
import sombraMarcador from "leaflet/dist/images/marker-shadow.png";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import type { PosicaoAtualVendedorDto, TrajetoVendedorDto } from "@/lib/rastreio";
import { formatarDataHora } from "@/lib/formatacao";

// Fix conhecido do react-leaflet + bundler (webpack/turbopack): os ícones
// padrão do Leaflet são referenciados por URL relativa que o bundler não
// resolve sozinho - sem isso, os pinos do mapa ficam sem ícone (só o
// quadrado quebrado do navegador). Import direto dos assets já instalados
// (pacote leaflet), sem depender de CDN externo.
const iconePadrao = L.icon({
  iconUrl: iconeMarcador.src,
  iconRetinaUrl: iconeMarcadorRetina.src,
  shadowUrl: sombraMarcador.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = iconePadrao;

const CENTRO_PADRAO: [number, number] = [-14.235, -51.9253]; // centro geográfico do Brasil - fallback sem nenhuma posição pra centralizar

// Mapa (Leaflet + OpenStreetMap, OS-WEB-24 - decisão confirmada com o
// usuário: sem custo/API key, diferente de Google Maps) - só desenha o que
// recebe via prop, nunca decide "quem é da equipe" (isso é escopo do
// backend, ver VendedorEscopoService). Client Component "puro" (sem
// buscar dado nenhum) - importado via next/dynamic com ssr:false pelo
// componente pai (painel-rastreio-equipe.tsx), já que Leaflet depende de
// `window`.
export function MapaEquipe({
  posicoes,
  vendedorSelecionadoId,
  trajeto,
}: {
  posicoes: PosicaoAtualVendedorDto[];
  vendedorSelecionadoId: string | null;
  trajeto: TrajetoVendedorDto | null;
}) {
  const centro: [number, number] =
    posicoes.length > 0 ? [posicoes[0].latitude, posicoes[0].longitude] : CENTRO_PADRAO;
  const linhaTrajeto = trajeto?.pontos.map(
    (ponto): [number, number] => [ponto.latitude, ponto.longitude],
  );

  return (
    <MapContainer center={centro} zoom={posicoes.length > 0 ? 6 : 4} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {posicoes.map((posicao) => (
        <Marker
          key={posicao.vendedorId}
          position={[posicao.latitude, posicao.longitude]}
          opacity={
            vendedorSelecionadoId && vendedorSelecionadoId !== posicao.vendedorId ? 0.5 : 1
          }
        >
          <Popup>
            <strong>{posicao.vendedorNome ?? "Vendedor não identificado"}</strong>
            <br />
            Última posição: {formatarDataHora(posicao.capturadoEm)}
          </Popup>
        </Marker>
      ))}
      {linhaTrajeto && linhaTrajeto.length > 1 && (
        <Polyline positions={linhaTrajeto} pathOptions={{ color: "#4640DE" }} />
      )}
    </MapContainer>
  );
}
