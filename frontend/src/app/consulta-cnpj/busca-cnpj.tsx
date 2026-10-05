"use client";

import { useActionState } from "react";
import { consultarCnpj, type ResultadoConsultaCnpj } from "./actions";
import { CnpjResultadoView } from "./cnpj-resultado-view";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { Card } from "@/components/design/card";
import { PrimaryButton } from "@/components/design/button";
import { LoadingSkeleton } from "@/components/design/loading-skeleton";
import { formatarCnpj } from "@/lib/consulta-cnpj";

const ESTADO_INICIAL: ResultadoConsultaCnpj = { status: "idle" };

// Consulta pontual por CNPJ digitado à mão - Client Component só pro estado
// de interação (loading, último resultado). A chamada em si acontece via
// Server Action (actions.ts), nunca no navegador: token do provedor e URL
// da API ficam no servidor.
export function BuscaCnpj() {
  const [estado, formAction, pending] = useActionState(consultarCnpj, ESTADO_INICIAL);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <form action={formAction} className="flex gap-3">
          <input
            type="text"
            name="cnpj"
            placeholder="CNPJ (com ou sem pontuação)"
            required
            maxLength={18}
            autoComplete="off"
            className="flex-1 rounded-full bg-background px-4 py-2 text-sm text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-primary-light"
          />
          <PrimaryButton type="submit" disabled={pending}>
            {pending ? "Consultando..." : "Consultar"}
          </PrimaryButton>
        </form>
      </Card>

      {pending && <LoadingSkeleton linhas={3} />}

      {!pending && (estado.status === "erro" || estado.status === "limite") && (
        <ErroConexao mensagem={estado.mensagem} />
      )}

      {!pending && estado.status === "invalido" && <EstadoVazio mensagem={estado.mensagem} />}

      {!pending && estado.status === "nao-encontrado" && (
        <EstadoVazio mensagem={`CNPJ ${formatarCnpj(estado.cnpj)} não encontrado na Receita Federal.`} />
      )}

      {!pending && estado.status === "encontrado" && <CnpjResultadoView resultado={estado.resultado} />}
    </div>
  );
}
