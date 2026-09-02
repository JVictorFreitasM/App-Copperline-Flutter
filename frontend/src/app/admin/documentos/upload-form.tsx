"use client";

import { useActionState } from "react";
import { PrimaryButton } from "@/components/design/button";
import { Card } from "@/components/design/card";
import { uploadDocumento, ESTADO_UPLOAD_INICIAL } from "./actions";

// Client Component isolado (mesmo padrão de rodar-agora-form.tsx) - só o
// formulário precisa de useActionState, o resto da página continua Server
// Component. multipart/form-data automático (o browser define o boundary
// sozinho por ter um <input type="file"> dentro do form).
export function UploadDocumentoForm() {
  const [estado, acao, pending] = useActionState(uploadDocumento, ESTADO_UPLOAD_INICIAL);

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-ink">Enviar novo documento</h2>
      <form action={acao} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Nome
          <input
            type="text"
            name="nome"
            required
            maxLength={200}
            placeholder="Tabela de preços 2026"
            className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Categoria
          <input
            type="text"
            name="categoria"
            required
            maxLength={80}
            placeholder="Comercial"
            className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Arquivo (PDF, imagem ou planilha)
          <input
            type="file"
            name="arquivo"
            required
            accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.csv"
            className="text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
          />
        </label>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Enviando..." : "Enviar"}
        </PrimaryButton>
      </form>
      {estado.sucesso && <p className="mt-2 text-xs font-medium text-ink">{estado.sucesso}</p>}
      {estado.erro && <p className="mt-2 text-xs font-medium text-muted">{estado.erro}</p>}
    </Card>
  );
}
