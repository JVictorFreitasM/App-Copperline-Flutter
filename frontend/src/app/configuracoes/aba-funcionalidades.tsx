"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/design/switch";
import type { ConfiguracaoFuncionalidadesDto } from "@/lib/configuracoes";
import { atualizarConfiguracaoFuncionalidades } from "./actions";
import { LinhaConfiguracao, RodapeSalvar } from "./campos";

// Aba "Funcionalidades": liga/desliga partes do sistema sem publicar versão. A
// regra é aplicada no backend; web e app só refletem o estado.
export function AbaFuncionalidades({ inicial }: { inicial: ConfiguracaoFuncionalidadesDto }) {
  const [valores, setValores] = useState(inicial);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const alterado =
    valores.envioPedidosHabilitado !== inicial.envioPedidosHabilitado ||
    valores.cadastroClientesHabilitado !== inicial.cadastroClientesHabilitado;

  function salvar() {
    setErro(null);
    setSucesso(false);
    startTransition(async () => {
      try {
        const atualizado = await atualizarConfiguracaoFuncionalidades({
          envioPedidosHabilitado: valores.envioPedidosHabilitado,
          cadastroClientesHabilitado: valores.cadastroClientesHabilitado,
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
        titulo="Envio de pedidos"
        descricao="Desativado, os vendedores continuam montando e salvando orçamentos, mas nenhum pedido é enviado ao ERP. Pedidos já na fila do celular ficam retidos e saem quando for reativado."
      >
        <Switch
          checked={valores.envioPedidosHabilitado}
          disabled={pending}
          onChange={(valor) => setValores((atual) => ({ ...atual, envioPedidosHabilitado: valor }))}
        />
      </LinhaConfiguracao>

      <LinhaConfiguracao
        titulo="Cadastro de clientes"
        descricao="Desativado, não é possível cadastrar clientes novos (web e app). A edição de clientes existentes continua funcionando."
      >
        <Switch
          checked={valores.cadastroClientesHabilitado}
          disabled={pending}
          onChange={(valor) => setValores((atual) => ({ ...atual, cadastroClientesHabilitado: valor }))}
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
