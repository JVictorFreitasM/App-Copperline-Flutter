"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import iconeMarcador from "leaflet/dist/images/marker-icon.png";
import iconeMarcadorRetina from "leaflet/dist/images/marker-icon-2x.png";
import sombraMarcador from "leaflet/dist/images/marker-shadow.png";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import type { PosicaoAtualVendedorDto, TrajetoVendedorDto } from "@/lib/rastreio";
import type { VisitaEquipeDto } from "@/lib/visitas";
import { statusVisita } from "@/lib/visitas";
import { formatarDataHora } from "@/lib/formatacao";

// Fix conhecido do react-leaflet + bundler (webpack/turbopack): os ícones
// padrão do Leaflet são referenciados por URL relativa que o bundler não
// resolve sozinho - sem isso, os pinos do mapa ficam sem ícone (só o
// quadrado quebrado do navegador). Import direto dos assets já instalados
// (pacote leaflet), sem depender de CDN externo.
//
// `.src` (não a string direto) é o shape do webpack clássico do Next -
// Turbopack (Next 16, ver AGENTS.md) devolve a STRING do caminho direto
// pra import de imagem de dentro de node_modules, sem objeto {src}. Sem
// esse fallback, iconUrl ficava undefined e o Leaflet lançava "iconUrl not
// set in Icon options" ao montar o primeiro marker, derrubando a página.
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

// Pin de visita (extensão pedida pelo usuário sobre a OS-WEB-24: "pin de
// onde foi feita a visita e também a rota", os dois no mesmo mapa) - cor
// diferente do pin de posição do vendedor (accent-orange, ver
// globals.css/design-system), pra distinguir "onde ele esteve numa
// visita" de "onde ele está agora"/rota sem precisar de mais um ícone PNG.
const iconeVisita = L.divIcon({
  className: "",
  html: '<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#ffa53e;border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.25);"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -8],
});

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
  visitas,
}: {
  posicoes: PosicaoAtualVendedorDto[];
  vendedorSelecionadoId: string | null;
  trajeto: TrajetoVendedorDto | null;
  visitas: VisitaEquipeDto[];
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
      {visitas.map((visita) => {
        const status = statusVisita(visita);
        return (
          <Marker
            key={visita.id}
            position={[visita.checkinLat, visita.checkinLng]}
            icon={iconeVisita}
          >
            <Popup>
              <strong>{visita.cliente.razaoSocial ?? "Cliente não identificado"}</strong>
              <br />
              Check-in às {formatarDataHora(visita.checkinEm)}
              <br />
              {status.rotulo}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
