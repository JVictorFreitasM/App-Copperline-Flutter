"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/design/switch";
import type { AlcadaAprovacaoDto } from "@/lib/configuracoes";
import { atualizarAlcadaAprovacao } from "./actions";
import { CampoPercentual, LinhaConfiguracao, RodapeSalvar } from "./campos";

// Aba "Alçada de Aprovação" (config-aba-aprovação.jpg) - os 4 campos
// dependem uns dos outros pra fazer sentido (habilitar liga/desliga o uso
// dos 3 percentuais), por isso salvam juntos num único PATCH (diferente do
// padrão de auto-save por campo usado em admin/tipos-acondicionamento,
// onde cada campo é independente). limitePercentual é o MESMO valor que
// SolicitacaoDesconto.necessitaAprovacao já usa hoje pra decidir se um
// desconto de vendedor dispara aprovação - rotulado aqui como "Percentual
// máximo de desconto para vendedores" (mesmo nome da imagem de
// referência). habilitarAprovacaoPorAlcada/percentualAlcadaGerencial/
// percentualAlcadaSupervisao ainda não estão conectados a nenhuma lógica
// de aprovação (ver comentário no schema.prisma, model ConfiguracaoDesconto)
// - editáveis aqui, mas sem efeito no fluxo de aprovação ainda.
export function AbaAlcadaAprovacao({ inicial }: { inicial: AlcadaAprovacaoDto }) {
  const [valores, setValores] = useState(inicial);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const alterado =
    valores.habilitarAprovacaoPorAlcada !== inicial.habilitarAprovacaoPorAlcada ||
    valores.percentualAlcadaGerencial !== inicial.percentualAlcadaGerencial ||
    valores.percentualAlcadaSupervisao !== inicial.percentualAlcadaSupervisao ||
    valores.limitePercentual !== inicial.limitePercentual;

  function salvar() {
    setErro(null);
    setSucesso(false);
    startTransition(async () => {
      try {
        const atualizado = await atualizarAlcadaAprovacao({
          habilitarAprovacaoPorAlcada: valores.habilitarAprovacaoPorAlcada,
          percentualAlcadaGerencial: valores.percentualAlcadaGerencial,
          percentualAlcadaSupervisao: valores.percentualAlcadaSupervisao,
          limitePercentual: valores.limitePercentual,
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
        titulo="Habilitar aprovação de descontos por alçada"
        descricao="Se habilitado, quando um desconto em um item dentro de um pedido exceder o limite máximo configurado, o desconto ficará sujeito à aprovação do superior responsável."
      >
        <Switch
          checked={valores.habilitarAprovacaoPorAlcada}
          disabled={pending}
          onChange={(valor) => setValores((atual) => ({ ...atual, habilitarAprovacaoPorAlcada: valor }))}
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        titulo="Percentual de desconto da alçada gerencial"
        descricao="Este campo configura o percentual máximo de desconto que a alçada gerencial poderá aplicar sobre os itens dentro de um pedido."
      >
        <CampoPercentual
          valor={valores.percentualAlcadaGerencial}
          disabled={pending}
          onChange={(valor) => setValores((atual) => ({ ...atual, percentualAlcadaGerencial: valor }))}
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        titulo="Percentual de desconto da alçada de supervisão"
        descricao="Este campo configura o percentual máximo de desconto que a alçada de supervisão poderá aplicar sobre os itens dentro de um pedido."
      >
        <CampoPercentual
          valor={valores.percentualAlcadaSupervisao}
          disabled={pending}
          onChange={(valor) => setValores((atual) => ({ ...atual, percentualAlcadaSupervisao: valor }))}
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        titulo="Percentual máximo de desconto para vendedores"
        descricao="Este campo configura o percentual máximo de desconto que um vendedor poderá aplicar sobre os itens dentro de um pedido."
      >
        <CampoPercentual
          valor={valores.limitePercentual}
          disabled={pending}
          onChange={(valor) => setValores((atual) => ({ ...atual, limitePercentual: valor }))}
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
