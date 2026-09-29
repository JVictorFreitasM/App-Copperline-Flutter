"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, ApiError } from "@/lib/api";
import type { ProdutoDetalheDto, ResultadoCalculoQuantidadeDto } from "@/lib/produtos";
import type { EstadoEdicaoManual } from "./estado-edicao-manual";

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

  // codigoTabela/percentualDesconto opcionais (OS-novas-implementacoes.md
  // Bloco 1) - campo vazio nunca vira string vazia no body, senão o
  // backend trataria "" como um código de tabela de verdade.
  const codigoTabelaRaw = String(formData.get("codigoTabela") ?? "").trim();
  const percentualDescontoRaw = String(formData.get("percentualDesconto") ?? "").trim();
  const percentualDesconto = percentualDescontoRaw ? Number(percentualDescontoRaw) : undefined;

  try {
    const resultado = await apiFetch<ResultadoCalculoQuantidadeDto>(
      `/produtos/${encodeURIComponent(produtoId)}/calcular`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metrosDesejados,
          ...(codigoTabelaRaw && { codigoTabela: codigoTabelaRaw }),
          ...(percentualDesconto !== undefined && { percentualDesconto }),
        }),
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

// Campos que NAO vem do WK Radar (precoFabricacao/imagem, pedido do
// usuario) - editaveis so por admin, via PATCH/POST /admin/produtos/:id
// (backend ja valida role admin via requireRole, ver produtos.module.ts;
// aqui e' so' a chamada, sem checagem de role duplicada no front).
// Tipo/estado inicial ficam em ./estado-edicao-manual.ts (não aqui - um
// arquivo "use server" só pode exportar funções async).

export async function atualizarPrecoFabricacao(
  produtoId: string,
  _estadoAnterior: EstadoEdicaoManual,
  formData: FormData,
): Promise<EstadoEdicaoManual> {
  const valorRaw = String(formData.get("precoFabricacao") ?? "").trim();
  const valor = Number(valorRaw);
  if (!valorRaw || Number.isNaN(valor) || valor < 0) {
    return { erro: "Informe um valor válido (maior ou igual a zero).", sucesso: null };
  }

  try {
    await apiFetch<ProdutoDetalheDto>(`/admin/produtos/${encodeURIComponent(produtoId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ precoFabricacao: valor }),
      cache: "no-store",
    });
  } catch (error) {
    return {
      erro: error instanceof ApiError ? error.message : "Erro desconhecido ao salvar o preço.",
      sucesso: null,
    };
  }

  revalidatePath(`/produtos/${produtoId}`);
  return { erro: null, sucesso: "Preço de fabricação atualizado." };
}

// OS-novas-implementacoes.md Bloco 4 - mesmo endpoint de
// atualizarPrecoFabricacao (PATCH /admin/produtos/:id aceita os dois
// campos independentemente, ver AtualizarProdutoManualDto no backend),
// formulário separado só pra não misturar dois conceitos numa mesma tela.
export async function atualizarTipoAcondicionamento(
  produtoId: string,
  _estadoAnterior: EstadoEdicaoManual,
  formData: FormData,
): Promise<EstadoEdicaoManual> {
  const valor = String(formData.get("tipoAcondicionamentoId") ?? "").trim();

  try {
    await apiFetch<ProdutoDetalheDto>(`/admin/produtos/${encodeURIComponent(produtoId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipoAcondicionamentoId: valor || null }),
      cache: "no-store",
    });
  } catch (error) {
    return {
      erro: error instanceof ApiError ? error.message : "Erro desconhecido ao salvar.",
      sucesso: null,
    };
  }

  revalidatePath(`/produtos/${produtoId}`);
  return { erro: null, sucesso: "Tipo de acondicionamento atualizado." };
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
