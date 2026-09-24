"use client";

import { useState, useTransition } from "react";
import { PrimaryButton } from "@/components/design/button";
import { Badge } from "@/components/badge";
import type { VisitaResumoLlmDto } from "@/lib/visita-resumo-llm";
import { gerarResumoVisitas } from "./actions";

// docs/casos-de-uso-ia.md secao 2.4 - unico caso de resumo via LLM ainda
// sem tela nenhuma (GET /clientes/:id/resumo era backend-only ate aqui).
// Botao "Gerar resumo" em vez de carregar junto com o resto da tela (mesmo
// motivo do comentario em actions.ts) - o backend cacheia 24h, mas nao
// custa nada so no primeiro clique.
export function ResumoVisitas({ clienteId }: { clienteId: string }) {
  const [resumo, setResumo] = useState<VisitaResumoLlmDto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function gerar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await gerarResumoVisitas(clienteId);
      if (resultado.sucesso) {
        setResumo(resultado.resumo);
      } else {
        setErro(resultado.erro);
      }
    });
  }

  if (!resumo) {
    return (
      <div className="flex flex-col gap-2">
        <PrimaryButton type="button" onClick={gerar} disabled={pending}>
          {pending ? "Gerando..." : "Gerar resumo"}
        </PrimaryButton>
        {erro && <p className="text-xs font-medium text-muted">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {resumo.fonteCache && <Badge>Do cache (24h)</Badge>}
        <span className="text-xs text-muted">
          Baseado em {resumo.quantidadeNotasConsideradas} nota(s) de visita.
        </span>
      </div>

      {resumo.dadosInsuficientes ? (
        <p className="text-sm text-muted">{resumo.resumo}</p>
      ) : (
        <>
          <p className="text-sm text-ink">{resumo.resumo}</p>
          {resumo.pontosDeAtencao.length > 0 && (
            <ul className="flex flex-col gap-1">
              {resumo.pontosDeAtencao.map((ponto, indice) => (
                <li key={indice} className="text-sm text-ink before:content-['•_'] before:text-muted">
                  {ponto}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <button
        type="button"
        onClick={gerar}
        disabled={pending}
        className="self-start text-xs font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-40"
      >
        {pending ? "Gerando..." : "Gerar de novo"}
      </button>
      {erro && <p className="text-xs font-medium text-muted">{erro}</p>}
    </div>
  );
}
