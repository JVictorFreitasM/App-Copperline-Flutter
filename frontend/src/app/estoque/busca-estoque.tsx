"use client";

import { useActionState, useRef } from "react";
import { consultarEstoque, type ResultadoConsultaEstoque } from "./actions";
import { EstoqueResultadoView } from "./estoque-resultado-view";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { Card } from "@/components/design/card";
import { PrimaryButton } from "@/components/design/button";
import { LoadingSkeleton } from "@/components/design/loading-skeleton";

const ESTADO_INICIAL: ResultadoConsultaEstoque = { status: "idle" };

// Busca pontual em tempo real por código/ID digitado à mão (não é uma
// listagem paginada de dado já sincronizado, ver OS-WEB-14) - Client
// Component porque precisa de estado de interação (o que foi digitado, o
// resultado da última busca, o loading state) que um Server Component não
// tem como expressar. A consulta em si (chamada ao WK BI, que pode
// demorar) acontece via Server Action (actions.ts) - nunca no navegador,
// nunca com a URL/credenciais da API expostas ao cliente.
//
// Não recebe mais identificador pré-preenchido via query string (pedido
// do usuário, 2026-09-23: "Ver estoque" e o item da lista de mais pedidos
// levam pra uma tela DEDICADA por produto - estoque/[identificador]/page.tsx
// - não pra esta busca genérica).
export function BuscaEstoque() {
  const [estado, formAction, pending] = useActionState(consultarEstoque, ESTADO_INICIAL);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <form ref={formRef} action={formAction} className="flex gap-3">
          <input
            type="text"
            name="identificador"
            placeholder="Código ou ID do produto"
            required
            className="flex-1 rounded-full bg-background px-4 py-2 text-sm text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-primary-light"
          />
          <PrimaryButton type="submit" disabled={pending}>
            {pending ? "Consultando..." : "Consultar"}
          </PrimaryButton>
        </form>
      </Card>

      {pending && <LoadingSkeleton linhas={2} />}

      {!pending && estado.status === "erro" && <ErroConexao mensagem={estado.mensagem} />}

      {!pending && estado.status === "nao-encontrado" && (
        <EstadoVazio mensagem={`Produto '${estado.identificador}' não encontrado.`} />
      )}

      {!pending && estado.status === "sem-saldo" && (
        <EstadoVazio
          mensagem={`Produto '${estado.identificador}' encontrado, mas sem saldo em estoque.`}
        />
      )}

      {!pending && estado.status === "com-saldo" && (
        <EstoqueResultadoView resultado={estado.resultado} />
      )}
    </div>
  );
}
