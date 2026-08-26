"use server";

import { apiFetch, ApiError } from "@/lib/api";
import type { ResultadoCalculoQuantidadeDto } from "@/lib/produtos";

// Estado do useActionState no Client Component (simular-calculo.tsx) -
// mesmo padrão de ResultadoConsultaEstoque (estoque/actions.ts): um
// resultado discriminado por `status`, um por resposta possível de
// POST /produtos/:id/calcular. NUNCA calcula nada aqui - só repassa
// metrosDesejados pro backend e formata o erro/resultado que ele devolve
// (critério de aceite: simulação precisa bater exatamente com o backend,
// então o backend É o cálculo, o front não reimplementa nada).
export type ResultadoSimulacao =
  | { status: "idle" }
  | { status: "invalido"; mensagem: string }
  | { status: "sem-configuracao"; mensagem: string }
  | { status: "sucesso"; resultado: ResultadoCalculoQuantidadeDto }
  | { status: "erro"; mensagem: string };

export async function simularCalculo(
  produtoId: string,
  _estadoAnterior: ResultadoSimulacao,
  formData: FormData,
): Promise<ResultadoSimulacao> {
  const metrosDesejadosRaw = String(formData.get("metrosDesejados") ?? "").trim();
  const metrosDesejados = Number(metrosDesejadosRaw);

  if (!metrosDesejadosRaw || Number.isNaN(metrosDesejados) || metrosDesejados <= 0) {
    return { status: "invalido", mensagem: "Informe um valor de metros maior que zero." };
  }

  try {
    const resultado = await apiFetch<ResultadoCalculoQuantidadeDto>(
      `/produtos/${encodeURIComponent(produtoId)}/calcular`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrosDesejados }),
        cache: "no-store",
      },
    );
    return { status: "sucesso", resultado };
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      return { status: "sem-configuracao", mensagem: extrairMensagem(error) };
    }
    if (error instanceof ApiError && error.status === 400) {
      return { status: "invalido", mensagem: extrairMensagem(error) };
    }
    return {
      status: "erro",
      mensagem: error instanceof ApiError ? error.message : "Erro desconhecido ao simular o cálculo.",
    };
  }
}

// apiFetch (lib/api.ts) embute o corpo cru da resposta de erro na mensagem
// (formato "API respondeu 422 para <url>: {"message":"...","error":...}")
// - extrai só o `message` do JSON do Nest quando possível, pra não mostrar
// a URL/status internos numa mensagem voltada ao usuário final.
function extrairMensagem(error: ApiError): string {
  const inicioJson = error.message.indexOf("{");
  if (inicioJson === -1) {
    return error.message;
  }
  try {
    const corpo = JSON.parse(error.message.slice(inicioJson)) as { message?: string | string[] };
    if (Array.isArray(corpo.message)) {
      return corpo.message.join("; ");
    }
    return corpo.message ?? error.message;
  } catch {
    return error.message;
  }
}
