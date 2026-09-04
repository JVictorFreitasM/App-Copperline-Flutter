"use client";

import { useActionState } from "react";
import { PrimaryButton } from "@/components/design/button";
import { enviarImagemProduto, ESTADO_EDICAO_MANUAL_INICIAL } from "./actions";

// Admin-only (checagem real no backend) - web apenas, pedido do usuário
// ("deixe um campo separado pra podermos upar imagem do produto - apenas
// web"). multipart/form-data automático (mesmo padrão de
// admin/documentos/upload-form.tsx).
export function EnviarImagemForm({ produtoId }: { produtoId: string }) {
  const acaoComId = enviarImagemProduto.bind(null, produtoId);
  const [estado, acao, pending] = useActionState(acaoComId, ESTADO_EDICAO_MANUAL_INICIAL);

  return (
    <form action={acao} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Imagem do produto (JPEG, PNG ou WEBP)
        <input
          type="file"
          name="imagem"
          required
          accept="image/jpeg,image/png,image/webp"
          className="text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
        />
      </label>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Enviar imagem"}
      </PrimaryButton>
      {estado.sucesso && <p className="text-xs font-medium text-ink">{estado.sucesso}</p>}
      {estado.erro && <p className="text-xs font-medium text-muted">{estado.erro}</p>}
    </form>
  );
}
