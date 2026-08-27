"use client";

import { useActionState } from "react";
import { PrimaryButton } from "@/components/design/button";
import { Card } from "@/components/design/card";
import { importarSwagger, ESTADO_INICIAL } from "./actions";

// Assistente de importação (OS-WEB-25) - interface pra POST
// /admin/endpoints/importar-swagger (OS-BACKEND-30). useActionState (mesmo
// padrão da OS-WEB-28) porque o resultado (2 blocos de código) é grande
// demais pra viajar como query string de um redirect, e não há nada a
// persistir na navegação - o backend só devolve texto, nunca aplica nada.
export function ImportarSwaggerForm() {
  const [estado, acao, pending] = useActionState(importarSwagger, ESTADO_INICIAL);

  return (
    <div className="flex flex-col gap-4">
      <form action={acao} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          URL do documento Swagger/OpenAPI
          <input
            type="url"
            name="swaggerUrl"
            required
            placeholder="https://.../swagger/v1/swagger.json"
            className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Caminho do endpoint (como aparece em &quot;paths&quot; no documento)
          <input
            type="text"
            name="caminhoEndpoint"
            required
            placeholder="/api/empresarial/v1/cliente"
            className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Nome da entidade (kebab-case, ex: &quot;produto&quot;, &quot;nota-fiscal&quot;)
          <input
            type="text"
            name="nomeEntidade"
            required
            pattern="[a-z][a-z0-9-]*"
            placeholder="nova-entidade"
            className="rounded-full bg-surface px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          />
        </label>
        <PrimaryButton type="submit" className="self-start" disabled={pending}>
          {pending ? "Importando..." : "Gerar rascunho"}
        </PrimaryButton>
      </form>

      {estado.erro && <Card className="text-sm text-ink">{estado.erro}</Card>}

      {estado.resultado && (
        <div className="flex flex-col gap-4">
          {/* Aviso proeminente e não ignorável (criterio de aceite explicito
              da OS) - bloco de destaque total (bg-ink), nao um rodape
              discreto. */}
          <div className="rounded-card bg-ink p-4 text-sm font-semibold text-white">
            ⚠ Isto é um RASCUNHO gerado automaticamente. Revise campo a campo antes de
            aplicar — nunca cole isto em produção sem revisão humana (cursor incremental,
            chave de dedup e campos aninhados/array nunca são inferidos sozinhos).
          </div>

          {estado.resultado.camposNaoMapeados.length > 0 && (
            <Card className="text-sm text-ink">
              <p className="font-medium">Campos que precisam de revisão manual:</p>
              <p className="mt-1 text-muted">{estado.resultado.camposNaoMapeados.join(", ")}</p>
            </Card>
          )}

          <Card>
            <h2 className="mb-2 text-sm font-semibold text-ink">
              Rascunho do model Prisma ({estado.resultado.nomeEntidade})
            </h2>
            <pre className="overflow-x-auto rounded-card bg-background p-4 text-xs text-ink">
              {estado.resultado.modeloPrismaRascunho}
            </pre>
          </Card>

          <Card>
            <h2 className="mb-2 text-sm font-semibold text-ink">Rascunho da SyncStrategy</h2>
            <pre className="overflow-x-auto rounded-card bg-background p-4 text-xs text-ink">
              {estado.resultado.syncStrategyRascunho}
            </pre>
          </Card>
        </div>
      )}
    </div>
  );
}
