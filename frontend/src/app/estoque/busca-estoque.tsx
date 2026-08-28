"use client";

import { useActionState, useEffect, useRef } from "react";
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
//
// `identificadorInicial` (vindo do atalho "Ver estoque" na tela de
// detalhe do produto, via query string) preenche o campo e dispara a
// busca sozinho ao montar - sem isso, o atalho so preencheria o campo,
// exigindo mais um clique.
export function BuscaEstoque({ identificadorInicial }: { identificadorInicial?: string }) {
  const [estado, formAction, pending] = useActionState(consultarEstoque, ESTADO_INICIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (identificadorInicial) {
      formRef.current?.requestSubmit();
    }
    // Só na montagem - disparar de novo a cada render re-executaria a
    // busca sem o usuário pedir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <form ref={formRef} action={formAction} className="flex gap-3">
          <input
            type="text"
            name="identificador"
            placeholder="Código ou ID do produto"
            defaultValue={identificadorInicial}
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
              // Estoque.svc (fonte atual) devolve saldo CONSOLIDADO por
              // produto, sem quebra por local de estocagem (ver comentário
              // em lib/estoque.ts) - localNome/localCodigo sempre nulos por
              // enquanto, por isso o título aqui é o saldo em si, não um
              // local (que induziria a pensar que falta identificar algo).
              titulo={item.localNome ?? item.localCodigo ?? "Saldo total"}
              subtitulo={
                item.lote || item.fabricadoEm
                  ? `Lote ${item.lote ?? "—"} · Fabricado em ${item.fabricadoEm ?? "—"}`
                  : undefined
              }
              valor={item.quantidade}
            />
          ))}
          {estado.resultado.atualizadoEm && (
            <p className="text-xs text-muted">
              Atualizado em {new Date(estado.resultado.atualizadoEm).toLocaleString("pt-BR")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
