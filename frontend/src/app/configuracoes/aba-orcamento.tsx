"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/design/switch";
import type { ConfiguracaoOrcamentoDto } from "@/lib/configuracoes";
import { atualizarConfiguracaoOrcamento } from "./actions";
import { LinhaConfiguracao, RodapeSalvar } from "./campos";

// Aba "Orçamento" (config-aba-orçamento.jpg) - "Orçamento" como conceito
// de negócio distinto de Pedido ainda não existe no modelo de dados (ver
// OS-pendentes-claude-code.md); estas 4 flags existem só como
// configuração, sem ainda ligar a nenhum fluxo real de orçamento.
export function AbaOrcamento({ inicial }: { inicial: ConfiguracaoOrcamentoDto }) {
  const [valores, setValores] = useState(inicial);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const alterado =
    valores.habilitarCriacaoOrcamento !== inicial.habilitarCriacaoOrcamento ||
    valores.permitirVendedorTransformarEmPedido !== inicial.permitirVendedorTransformarEmPedido ||
    valores.criarPedidoSugeridoComoOrcamento !== inicial.criarPedidoSugeridoComoOrcamento ||
    valores.permitirAlteracaoVendedorOrcamentoCriado !==
      inicial.permitirAlteracaoVendedorOrcamentoCriado ||
    valores.permitirItensRepetidos !== inicial.permitirItensRepetidos;

  function salvar() {
    setErro(null);
    setSucesso(false);
    startTransition(async () => {
      try {
        const atualizado = await atualizarConfiguracaoOrcamento({
          habilitarCriacaoOrcamento: valores.habilitarCriacaoOrcamento,
          permitirVendedorTransformarEmPedido: valores.permitirVendedorTransformarEmPedido,
          criarPedidoSugeridoComoOrcamento: valores.criarPedidoSugeridoComoOrcamento,
          permitirAlteracaoVendedorOrcamentoCriado: valores.permitirAlteracaoVendedorOrcamentoCriado,
          permitirItensRepetidos: valores.permitirItensRepetidos,
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
      <LinhaConfiguracao titulo="Habilitar criação de Orçamento." descricao="Permitir que usuários criem Orçamento.">
        <Switch
          checked={valores.habilitarCriacaoOrcamento}
          disabled={pending}
          onChange={(valor) => setValores((atual) => ({ ...atual, habilitarCriacaoOrcamento: valor }))}
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        titulo="Permitir ao Vendedor transformar um Orçamento em Pedido"
        descricao="Permite que os usuários transformem o Orçamento em Pedido (ou cancelem o orçamento) no Aplicativo Móvel."
      >
        <Switch
          checked={valores.permitirVendedorTransformarEmPedido}
          disabled={pending}
          onChange={(valor) =>
            setValores((atual) => ({ ...atual, permitirVendedorTransformarEmPedido: valor }))
          }
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        titulo="Criar pedido sugerido inicialmente como Orçamento"
        descricao="Se habilitado, criará os pedidos sugeridos inicialmente como Orçamento."
      >
        <Switch
          checked={valores.criarPedidoSugeridoComoOrcamento}
          disabled={pending}
          onChange={(valor) =>
            setValores((atual) => ({ ...atual, criarPedidoSugeridoComoOrcamento: valor }))
          }
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        titulo="Permitir alteração de vendedor de um orçamento criado"
        descricao="Se habilitado, irá permitir a um usuário Gerencial alterar o vendedor de um orçamento criado."
      >
        <Switch
          checked={valores.permitirAlteracaoVendedorOrcamentoCriado}
          disabled={pending}
          onChange={(valor) =>
            setValores((atual) => ({ ...atual, permitirAlteracaoVendedorOrcamentoCriado: valor }))
          }
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        titulo="Permitir itens repetidos no pedido"
        descricao="Se habilitado, deixa incluir o mesmo produto mais de uma vez no mesmo pedido (por padrão, bloqueado)."
      >
        <Switch
          checked={valores.permitirItensRepetidos}
          disabled={pending}
          onChange={(valor) => setValores((atual) => ({ ...atual, permitirItensRepetidos: valor }))}
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
