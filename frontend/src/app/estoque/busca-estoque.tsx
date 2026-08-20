"use client";

import { useActionState } from "react";
import { consultarEstoque, type ResultadoConsultaEstoque } from "./actions";
import { ErroConexao, EstadoVazio } from "@/components/listagem-feedback";
import { Card } from "@/components/design/card";
import { PrimaryButton } from "@/components/design/button";
import { ListItem } from "@/components/design/list-item";
import { LoadingSkeleton } from "@/components/design/loading-skeleton";

const ESTADO_INICIAL: ResultadoConsultaEstoque = { status: "idle" };

// Busca pontual em tempo real (nao e uma listagem paginada de dado ja
// sincronizado, ver OS-WEB-14) - Client Component porque precisa de estado
// de interacao (o que foi digitado, o resultado da ultima busca, o loading
// state) que um Server Component nao tem como expressar. A consulta em si
// (chamada ao WK BI, que pode demorar) acontece via Server Action
// (actions.ts) - nunca no navegador, nunca com a URL/credenciais da API
// expostas ao cliente. Retrofit visual (OS-WEB-16): os três estados de
// resultado (com saldo, sem saldo, não encontrado) usam o mesmo
// vocabulário visual (Card/ListItem), nenhum estilo improvisado por
// estado; loading usa o LoadingSkeleton confirmado pela referência em vez
// de texto solto.
export function BuscaEstoque() {
  const [estado, formAction, pending] = useActionState(consultarEstoque, ESTADO_INICIAL);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <form action={formAction} className="flex gap-3">
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
        <div className="flex flex-col gap-3">
          {estado.resultado.itens.map((item, indice) => (
            <ListItem
              key={indice}
              titulo={item.localNome ?? item.localCodigo ?? "Local não identificado"}
              subtitulo={
                item.lote || item.fabricadoEm
                  ? `Lote ${item.lote ?? "—"} · Fabricado em ${item.fabricadoEm ?? "—"}`
                  : undefined
              }
              valor={item.quantidade}
            />
          ))}
        </div>
      )}
    </div>
  );
}
