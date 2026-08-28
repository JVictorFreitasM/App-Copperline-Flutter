"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { PosicaoAtualVendedorDto, TrajetoVendedorDto } from "@/lib/rastreio";
import type { VisitaEquipeDto } from "@/lib/visitas";
import { formatarDataHora } from "@/lib/formatacao";
import { Card } from "@/components/design/card";
import { LoadingSkeleton } from "@/components/design/loading-skeleton";
import { EstadoVazio } from "@/components/listagem-feedback";

// ssr:false obrigatório - Leaflet acessa `window` na inicialização, e essa
// página é renderizada no servidor por padrão (Server Component pai busca
// os dados). Ver skill nextjs-best-practices/doc de lazy-loading desta
// versão do Next.
const MapaEquipe = dynamic(() => import("./mapa-equipe").then((mod) => mod.MapaEquipe), {
  ssr: false,
  loading: () => <LoadingSkeleton linhas={1} />,
});

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Painel interativo (OS-WEB-24) - Client Component só pela interação
// (selecionar vendedor + data pra ver o trajeto do dia): o Server
// Component pai (page.tsx) já buscou as ÚLTIMAS posições (sem precisar de
// interação nenhuma); o trajeto de um vendedor/dia especifico é buscado
// sob demanda aqui via fetch pro Route Handler local (BFF, ver
// app/api/rastreio/equipe/[vendedorId]/trajeto/route.ts) - sem isso,
// trocar de vendedor/data recarregaria a página inteira.
export function PainelRastreioEquipe({ posicoes }: { posicoes: PosicaoAtualVendedorDto[] }) {
  const [vendedorSelecionadoId, setVendedorSelecionadoId] = useState<string | null>(null);
  const [data, setData] = useState<string>(hojeIso());
  const [trajeto, setTrajeto] = useState<TrajetoVendedorDto | null>(null);
  const [visitas, setVisitas] = useState<VisitaEquipeDto[]>([]);
  const [carregandoTrajeto, setCarregandoTrajeto] = useState(false);
  const [erroTrajeto, setErroTrajeto] = useState<string | null>(null);

  // Busca trajeto (rota do dia) e visitas (pins de onde parou) do mesmo
  // vendedor/dia em paralelo - duas chamadas independentes (extensão
  // pedida pelo usuário sobre a OS-WEB-24 original: "pin de onde foi feita
  // a visita e também a rota", tudo no mesmo mapa). Falha numa não derruba
  // a outra - mesmo critério de resiliência já usado no painel (OS-WEB-29).
  async function buscarDetalhesVendedor(vendedorId: string, dataEscolhida: string) {
    setVendedorSelecionadoId(vendedorId);
    setCarregandoTrajeto(true);
    setErroTrajeto(null);

    const [resultadoTrajeto, resultadoVisitas] = await Promise.allSettled([
      fetch(
        `/api/rastreio/equipe/${encodeURIComponent(vendedorId)}/trajeto?data=${encodeURIComponent(dataEscolhida)}`,
      ).then(async (resposta) => {
        const corpo = await resposta.json();
        if (!resposta.ok) {
          throw new Error(corpo.message ?? "Falha ao buscar o trajeto.");
        }
        return corpo as TrajetoVendedorDto;
      }),
      fetch(
        `/api/rastreio/equipe/${encodeURIComponent(vendedorId)}/visitas?data=${encodeURIComponent(dataEscolhida)}`,
      ).then(async (resposta) => {
        const corpo = await resposta.json();
        if (!resposta.ok) {
          throw new Error(corpo.message ?? "Falha ao buscar as visitas.");
        }
        return corpo as VisitaEquipeDto[];
      }),
    ]);

    if (resultadoTrajeto.status === "fulfilled") {
      setTrajeto(resultadoTrajeto.value);
      setErroTrajeto(null);
    } else {
      setTrajeto(null);
      setErroTrajeto(
        resultadoTrajeto.reason instanceof Error
          ? resultadoTrajeto.reason.message
          : "Erro desconhecido.",
      );
    }

    setVisitas(resultadoVisitas.status === "fulfilled" ? resultadoVisitas.value : []);
    setCarregandoTrajeto(false);
  }

  function selecionarData(novaData: string) {
    setData(novaData);
    if (vendedorSelecionadoId) {
      buscarDetalhesVendedor(vendedorSelecionadoId, novaData);
    }
  }

  if (posicoes.length === 0) {
    return <EstadoVazio mensagem="Nenhum vendedor da equipe com posição registrada ainda." />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="flex flex-col gap-3 lg:col-span-1">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Ver trajeto do dia
          <input
            type="date"
            value={data}
            max={hojeIso()}
            onChange={(evento) => selecionarData(evento.target.value)}
            className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          />
        </label>

        <div className="flex flex-col gap-2">
          {posicoes.map((posicao) => (
            <button
              key={posicao.vendedorId}
              type="button"
              onClick={() => buscarDetalhesVendedor(posicao.vendedorId, data)}
              className={`rounded-card p-3 text-left text-sm transition ${
                vendedorSelecionadoId === posicao.vendedorId
                  ? "bg-ink text-white"
                  : "bg-background text-ink hover:opacity-80"
              }`}
            >
              <p className="font-medium">{posicao.vendedorNome ?? "Vendedor não identificado"}</p>
              <p
                className={`text-xs ${
                  vendedorSelecionadoId === posicao.vendedorId ? "text-white/70" : "text-muted"
                }`}
              >
                Última posição: {formatarDataHora(posicao.capturadoEm)}
              </p>
            </button>
          ))}
        </div>

        {carregandoTrajeto && <p className="text-xs text-muted">Carregando trajeto e visitas...</p>}
        {erroTrajeto && <p className="text-xs text-muted">{erroTrajeto}</p>}
        {!carregandoTrajeto && vendedorSelecionadoId && trajeto && trajeto.pontos.length === 0 && (
          <p className="text-xs text-muted">Sem pontos de rastreio registrados nesse dia.</p>
        )}
        {!carregandoTrajeto && vendedorSelecionadoId && (
          <p className="text-xs text-muted">
            {visitas.length === 0
              ? "Sem visita registrada nesse dia."
              : `${visitas.length} visita(s) registrada(s) nesse dia (pins laranja no mapa).`}
          </p>
        )}
      </Card>

      <Card className="h-[560px] overflow-hidden p-0 lg:col-span-2">
        <MapaEquipe
          posicoes={posicoes}
          vendedorSelecionadoId={vendedorSelecionadoId}
          trajeto={trajeto}
          visitas={visitas}
        />
      </Card>
    </div>
  );
}
