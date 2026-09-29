"use client";

import { useActionState } from "react";
import { PrimaryButton } from "@/components/design/button";
import { Card } from "@/components/design/card";
import { enviarImagensEmLote } from "./actions";
import { ESTADO_UPLOAD_LOTE_INICIAL } from "./estado-produtos-admin";

// Upload em massa (pedido do usuário, 2026-09-29) - nome de cada arquivo
// (sem extensão) precisa ser o CÓDIGO do produto (ex: 50397.jpg), não o
// id interno. `webkitdirectory` deixa selecionar a pasta inteira de uma
// vez (suportado nos navegadores baseados em Chromium/Edge - se o
// navegador não suportar, cai pra seleção múltipla de arquivo normal, sem
// quebrar).
export function UploadLoteForm() {
  const [estado, acao, pending] = useActionState(enviarImagensEmLote, ESTADO_UPLOAD_LOTE_INICIAL);

  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold text-ink">Importar imagens em massa</h2>
      <p className="mb-3 text-xs text-muted">
        Selecione várias imagens (ou uma pasta inteira) de uma vez. O nome de cada arquivo, sem a
        extensão, precisa ser o <strong>código</strong> do produto (ex: <code>50397.jpg</code>) - não
        o id interno. Imagem já cadastrada é substituída automaticamente.
      </p>
      <form action={acao} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Imagens (JPEG, PNG ou WEBP)
          <input
            type="file"
            name="imagens"
            multiple
            // @ts-expect-error -- webkitdirectory não é padrão do HTML/React, mas é amplamente suportado
            webkitdirectory=""
            accept="image/jpeg,image/png,image/webp"
            className="text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-solid file:px-4 file:py-2 file:text-sm file:font-medium file:text-on-solid"
          />
        </label>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Enviando..." : "Importar"}
        </PrimaryButton>
      </form>

      {estado.erro && <p className="mt-3 text-xs font-medium text-ink">{estado.erro}</p>}

      {estado.resultado && (
        <div className="mt-4 flex flex-col gap-3 text-xs">
          <p className="font-medium text-ink">
            {estado.resultado.aplicados.length} aplicada(s) · {estado.resultado.naoEncontrados.length}{" "}
            sem produto correspondente · {estado.resultado.ambiguos.length} ambígua(s) ·{" "}
            {estado.resultado.invalidos.length} inválida(s)
          </p>

          {estado.resultado.naoEncontrados.length > 0 && (
            <div>
              <p className="font-medium text-muted">
                Sem produto com esse código (nenhuma imagem aplicada):
              </p>
              <p className="text-ink">{estado.resultado.naoEncontrados.join(", ")}</p>
            </div>
          )}

          {estado.resultado.ambiguos.length > 0 && (
            <div>
              <p className="font-medium text-muted">
                Código com mais de um produto (nenhuma imagem aplicada, revisar manualmente):
              </p>
              <p className="text-ink">{estado.resultado.ambiguos.join(", ")}</p>
            </div>
          )}

          {estado.resultado.invalidos.length > 0 && (
            <div>
              <p className="font-medium text-muted">Arquivos com formato inválido:</p>
              <p className="text-ink">
                {estado.resultado.invalidos.map((item) => `${item.codigo} (${item.motivo})`).join(", ")}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
