"use server";

import { adminApiFetch } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";

export interface ImportarSwaggerResultado {
  nomeEntidade: string;
  avisoRevisaoNecessaria: true;
  modeloPrismaRascunho: string;
  syncStrategyRascunho: string;
  camposNaoMapeados: string[];
}

export interface EstadoImportacao {
  resultado: ImportarSwaggerResultado | null;
  erro: string | null;
}

export const ESTADO_INICIAL: EstadoImportacao = { resultado: null, erro: null };

// useActionState (mesmo padrao da OS-WEB-28) em vez de redirect com o
// resultado na query string - o rascunho gerado (2 blocos de codigo) e'
// grande demais pra caber numa URL, e nao ha nada a persistir aqui (o
// backend so gera texto, nunca aplica nada sozinho - ver OS-BACKEND-30).
export async function importarSwagger(
  _estadoAnterior: EstadoImportacao,
  formData: FormData,
): Promise<EstadoImportacao> {
  const swaggerUrl = String(formData.get("swaggerUrl") ?? "").trim();
  const caminhoEndpoint = String(formData.get("caminhoEndpoint") ?? "").trim();
  const nomeEntidade = String(formData.get("nomeEntidade") ?? "").trim();

  try {
    const resultado = await adminApiFetch<ImportarSwaggerResultado>(
      "/admin/endpoints/importar-swagger",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swaggerUrl, caminhoEndpoint, nomeEntidade }),
        cache: "no-store",
      },
    );
    return { resultado, erro: null };
  } catch (error) {
    return {
      resultado: null,
      erro: error instanceof ApiError ? error.message : "Erro desconhecido ao importar o Swagger.",
    };
  }
}
