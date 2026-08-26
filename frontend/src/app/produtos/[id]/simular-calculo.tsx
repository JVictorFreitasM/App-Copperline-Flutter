"use client";

import { useActionState } from "react";
import { simularCalculo, type ResultadoSimulacao } from "./actions";
import { rotuloUnidadeCalculo } from "@/lib/produtos";
import { formatarMoeda } from "@/lib/formatacao";
import { Card } from "@/components/design/card";
import { PrimaryButton } from "@/components/design/button";

const ESTADO_INICIAL: ResultadoSimulacao = { status: "idle" };

// Campo de simulação (OS-WEB-22) - mesmo padrão de BuscaEstoque
// (estoque/busca-estoque.tsx): Client Component só pelo estado de
// interação (o que foi digitado, o resultado da última simulação), a
// chamada de verdade acontece via Server Action (actions.ts), nunca
// recalculada no navegador. "Antes de qualquer pedido de verdade" (ver
// escopo da OS) - isso aqui NUNCA cria pedido, só chama
// POST /produtos/:id/calcular e mostra o resultado.
export function SimularCalculo({ produtoId }: { produtoId: string }) {
  const [estado, formAction, pending] = useActionState(
    simularCalculo.bind(null, produtoId),
    ESTADO_INICIAL,
  );

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Simular cálculo de quantidade</h2>
        <p className="text-sm text-muted">
          Informe os metros desejados pra ver como o backend calcularia a quantidade e o valor -
          sem criar nenhum pedido.
        </p>
      </div>

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Metros desejados
          <input
            type="number"
            name="metrosDesejados"
            step="0.001"
            min="0"
            required
            className="w-40 rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          />
        </label>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Calculando..." : "Simular"}
        </PrimaryButton>
      </form>

      {!pending && estado.status === "invalido" && (
        <p className="text-sm text-muted">{estado.mensagem}</p>
      )}
      {!pending && estado.status === "sem-configuracao" && (
        <p className="text-sm text-muted">{estado.mensagem}</p>
      )}
      {!pending && estado.status === "erro" && (
        <p className="text-sm text-muted">Falha ao consultar a API: {estado.mensagem}</p>
      )}
      {!pending && estado.status === "sucesso" && (
        <div className="rounded-card bg-background p-4">
          <p className="text-xs text-muted">Resultado do cálculo</p>
          <p className="text-2xl font-bold text-ink">
            {estado.resultado.quantidade} {rotuloUnidadeCalculo(estado.resultado.unidade)}
          </p>
          <p className="text-sm text-muted">
            Valor total: {formatarMoeda(String(estado.resultado.valorTotal))}
          </p>
        </div>
      )}
    </Card>
  );
}
