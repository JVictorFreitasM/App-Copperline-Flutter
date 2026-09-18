"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/design/switch";
import type { ConfiguracaoRastreioDto } from "@/lib/configuracoes";
import { atualizarConfiguracaoRastreio } from "./actions";
import { CampoHorario, CampoInteiro, LinhaConfiguracao, RodapeSalvar } from "./campos";

// Aba "Rastreio" (config-aba-rastreio.jpg) - escopo desta OS é só Web
// (Next.js): estes campos ficam disponíveis via GET/PATCH pro admin
// configurar, mas o app mobile (Flutter) ainda não lê/aplica nenhum deles
// (fora de escopo, "Sem alterações em mobile/Flutter" no cabeçalho da OS).
export function AbaRastreio({ inicial }: { inicial: ConfiguracaoRastreioDto }) {
  const [valores, setValores] = useState(inicial);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const alterado = (Object.keys(valores) as (keyof ConfiguracaoRastreioDto)[])
    .filter((chave) => chave !== "atualizadoEm")
    .some((chave) => valores[chave] !== inicial[chave]);

  function salvar() {
    if (
      valores.distanciaMaximaClienteRegistroPedidoMetros !== null &&
      valores.distanciaMaximaClienteRegistroPedidoMetros < 50
    ) {
      setErro("Distância máxima do cliente para registro de pedido: mínimo 50 metros.");
      return;
    }
    if (valores.distanciaMaximaClienteRegistroVisitaMetros < 50) {
      setErro("Distância máxima do cliente para registro de visita: mínimo 50 metros.");
      return;
    }

    setErro(null);
    setSucesso(false);
    startTransition(async () => {
      try {
        const atualizado = await atualizarConfiguracaoRastreio({
          desabilitarEdicaoHorarioTrabalhoAndroid: valores.desabilitarEdicaoHorarioTrabalhoAndroid,
          habilitarRastreamentoSabados: valores.habilitarRastreamentoSabados,
          habilitarRastreamentoDomingos: valores.habilitarRastreamentoDomingos,
          horarioInicioRastreamento: valores.horarioInicioRastreamento,
          horarioTerminoRastreamento: valores.horarioTerminoRastreamento,
          precisaoMinimaMetrosGps: valores.precisaoMinimaMetrosGps,
          tempoMinimoAcordarGpsMs: valores.tempoMinimoAcordarGpsMs,
          permitirRegistroComGpsDesabilitado: valores.permitirRegistroComGpsDesabilitado,
          distanciaMaximaClienteRegistroPedidoMetros:
            valores.distanciaMaximaClienteRegistroPedidoMetros,
          distanciaMaximaClienteRegistroVisitaMetros:
            valores.distanciaMaximaClienteRegistroVisitaMetros,
        });
        setValores(atualizado);
        setSucesso(true);
      } catch {
        setErro("Falha ao salvar.");
      }
    });
  }

  return (
    <div className="flex flex-col divide-y divide-black/5">
      <LinhaConfiguracao
        titulo="Desabilitar edição de horário de trabalho no Android."
        descricao="Desabilita a edição de horário de início e fim de trabalho no aplicativo Android."
      >
        <Switch
          checked={valores.desabilitarEdicaoHorarioTrabalhoAndroid}
          disabled={pending}
          onChange={(valor) =>
            setValores((atual) => ({ ...atual, desabilitarEdicaoHorarioTrabalhoAndroid: valor }))
          }
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        titulo="Habilitar rastreamento aos sábados"
        descricao="Habilita o rastreamento de rotas do vendedor aos sábados."
      >
        <Switch
          checked={valores.habilitarRastreamentoSabados}
          disabled={pending}
          onChange={(valor) => setValores((atual) => ({ ...atual, habilitarRastreamentoSabados: valor }))}
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        titulo="Habilitar rastreamento aos domingos"
        descricao="Habilita o rastreamento de rotas do vendedor aos domingos."
      >
        <Switch
          checked={valores.habilitarRastreamentoDomingos}
          disabled={pending}
          onChange={(valor) => setValores((atual) => ({ ...atual, habilitarRastreamentoDomingos: valor }))}
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        titulo="Horário de início do rastreamento por GPS."
        descricao="Quando o cliente NÃO pode editar horário de trabalho, especifica o horário de início do rastreamento."
      >
        <CampoHorario
          valor={valores.horarioInicioRastreamento}
          disabled={pending}
          onChange={(valor) => setValores((atual) => ({ ...atual, horarioInicioRastreamento: valor }))}
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        titulo="Horário de término do rastreamento por GPS."
        descricao="Quando o cliente NÃO pode editar horário de trabalho, especifica o horário de término do rastreamento."
      >
        <CampoHorario
          valor={valores.horarioTerminoRastreamento}
          disabled={pending}
          onChange={(valor) => setValores((atual) => ({ ...atual, horarioTerminoRastreamento: valor }))}
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        titulo="Precisão mínima (em metros) do GPS."
        descricao="Especifica a distância mínima entre o último ponto que o GPS vai enviar informação."
      >
        <CampoInteiro
          valor={valores.precisaoMinimaMetrosGps}
          min={1}
          disabled={pending}
          onChange={(valor) =>
            setValores((atual) => ({ ...atual, precisaoMinimaMetrosGps: valor ?? atual.precisaoMinimaMetrosGps }))
          }
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        titulo="Tempo mínimo (em mili-segundos) para acordar o GPS."
        descricao="Especifica tempo mínimo que o GPS deve dormir até acordar para buscar a nova posição."
      >
        <CampoInteiro
          valor={valores.tempoMinimoAcordarGpsMs}
          min={0}
          disabled={pending}
          onChange={(valor) =>
            setValores((atual) => ({ ...atual, tempoMinimoAcordarGpsMs: valor ?? atual.tempoMinimoAcordarGpsMs }))
          }
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        titulo="Permitir registro de visita e envio de pedido com GPS desabilitado"
        descricao="Determina se o vendedor pode fazer um registro de visita e envio de pedido mesmo estando o GPS desativado em seu aparelho."
      >
        <Switch
          checked={valores.permitirRegistroComGpsDesabilitado}
          disabled={pending}
          onChange={(valor) =>
            setValores((atual) => ({ ...atual, permitirRegistroComGpsDesabilitado: valor }))
          }
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        titulo="Distância máxima do cliente para registro de pedido (metros)"
        descricao="Distância máxima do cliente, em metros, exigida para que o vendedor registre um pedido (mínimo 50 metros)."
      >
        <CampoInteiro
          valor={valores.distanciaMaximaClienteRegistroPedidoMetros}
          min={50}
          placeholder="sem exigência"
          disabled={pending}
          onChange={(valor) =>
            setValores((atual) => ({ ...atual, distanciaMaximaClienteRegistroPedidoMetros: valor }))
          }
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        titulo="Distância máxima do cliente para registro de visita (metros)"
        descricao="Distância máxima do cliente, em metros, exigida para que o vendedor registre uma visita (mínimo 50 metros)."
      >
        <CampoInteiro
          valor={valores.distanciaMaximaClienteRegistroVisitaMetros}
          min={50}
          disabled={pending}
          onChange={(valor) =>
            setValores((atual) => ({
              ...atual,
              distanciaMaximaClienteRegistroVisitaMetros:
                valor ?? atual.distanciaMaximaClienteRegistroVisitaMetros,
            }))
          }
        />
      </LinhaConfiguracao>

      <RodapeSalvar
        visivel={alterado}
        pending={pending}
        erro={erro}
        sucesso={sucesso}
        onSalvar={salvar}
      />
    </div>
  );
}
