"use server";

import { apiFetch, ApiError } from "@/lib/api";
import type { PaginatedResult } from "@/lib/pagination";
import type { ResultadoCalculoQuantidadeDto } from "@/lib/produtos";
import type { EstadoCriarPedido, OpcaoBusca } from "./tipos";

// Busca client-side (ver criar-pedido-form.tsx) chama estas duas direto -
// reaproveita os endpoints de listagem já existentes (GET /clientes?nome=,
// GET /produtos?nome=), sem endpoint novo só pra isso. Sem debounce aqui
// (fica no client) - cada chamada já é barata (mesma paginação padrão,
// limit baixo).
export async function buscarClientes(query: string): Promise<OpcaoBusca[]> {
  const termo = query.trim();
  if (!termo) return [];

  try {
    const resultado = await apiFetch<
      PaginatedResult<{ id: string; razaoSocial: string | null; nomeFantasia: string | null }>
    >(`/clientes?nome=${encodeURIComponent(termo)}&limit=8`, { cache: "no-store" });
    return resultado.data.map((cliente) => ({
      id: cliente.id,
      label: cliente.razaoSocial ?? cliente.nomeFantasia ?? "—",
    }));
  } catch {
    return [];
  }
}

export async function buscarProdutos(query: string): Promise<OpcaoBusca[]> {
  const termo = query.trim();
  if (!termo) return [];

  try {
    const resultado = await apiFetch<
      PaginatedResult<{ id: string; nome: string | null; codigo: string | null }>
    >(`/produtos?nome=${encodeURIComponent(termo)}&limit=8`, { cache: "no-store" });
    return resultado.data.map((produto) => ({
      id: produto.id,
      label: `${produto.nome ?? "—"}${produto.codigo ? ` (${produto.codigo})` : ""}`,
    }));
  } catch {
    return [];
  }
}

// Preview de cálculo por item (mesmo endpoint POST /produtos/:id/calcular
// já usado pela simulação na tela de produto) - mostra pro vendedor quanto
// aquele item vai custar ANTES de enviar o pedido inteiro.
export async function calcularItem(
  produtoId: string,
  metrosDesejados: number,
): Promise<{ status: "sucesso"; resultado: ResultadoCalculoQuantidadeDto } | { status: "erro"; mensagem: string }> {
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
    return {
      status: "erro",
      mensagem: error instanceof ApiError ? extrairMensagem(error) : "Erro desconhecido ao calcular.",
    };
  }
}

interface CriarPedidoInput {
  clienteId: string;
  percentualDesconto: number;
  itens: { produtoId: string; metrosDesejados: number }[];
}

interface CriarPedidoResultadoDto {
  status: "ENVIADO" | "AGUARDANDO_APROVACAO";
  pedidoId: string;
  valorTotal: number;
  idExternoErp: string | null;
  solicitacaoDescontoId: string | null;
}

export async function criarPedido(input: CriarPedidoInput): Promise<EstadoCriarPedido> {
  try {
    const resultado = await apiFetch<CriarPedidoResultadoDto>("/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    return {
      status: "sucesso",
      pedidoId: resultado.pedidoId,
      situacaoPedido: resultado.status,
    };
  } catch (error) {
    return {
      status: "erro",
      mensagem: error instanceof ApiError ? extrairMensagem(error) : "Erro desconhecido ao criar o pedido.",
    };
  }
}

// Mesmo helper de produtos/[id]/actions.ts (extrai só o `message` do JSON
// de erro do Nest) - duplicado aqui por não haver módulo compartilhado
// entre as duas rotas de "use server".
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
