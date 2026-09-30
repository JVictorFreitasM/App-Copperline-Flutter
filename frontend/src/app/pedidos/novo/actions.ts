"use server";

import { apiFetch, ApiError } from "@/lib/api";
import type { ContatoClienteDto } from "@/lib/clientes";
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

// Busca por nome E por código (não dá pra mandar os dois filtros juntos
// pro backend - ListarProdutosQueryDto os combina com AND - então dispara
// as duas em paralelo e mescla, sem duplicar produto que bater nos dois).
export async function buscarProdutos(query: string): Promise<OpcaoBusca[]> {
  const termo = query.trim();
  if (!termo) return [];

  type ProdutoBusca = { id: string; nome: string | null; codigo: string | null };

  const buscarPor = async (campo: "nome" | "codigo"): Promise<ProdutoBusca[]> => {
    try {
      const resultado = await apiFetch<PaginatedResult<ProdutoBusca>>(
        `/produtos?${campo}=${encodeURIComponent(termo)}&limit=8`,
        { cache: "no-store" },
      );
      return resultado.data;
    } catch {
      return [];
    }
  };

  const [porNome, porCodigo] = await Promise.all([buscarPor("nome"), buscarPor("codigo")]);
  const vistos = new Set<string>();
  const produtos: ProdutoBusca[] = [];
  for (const produto of [...porNome, ...porCodigo]) {
    if (vistos.has(produto.id)) continue;
    vistos.add(produto.id);
    produtos.push(produto);
  }
  return produtos.map((produto) => ({
    id: produto.id,
    label: `${produto.nome ?? "—"}${produto.codigo ? ` (${produto.codigo})` : ""}`,
  }));
}

// Preview de cálculo por item (mesmo endpoint POST /produtos/:id/calcular
// já usado pela simulação na tela de produto) - mostra pro vendedor quanto
// aquele item vai custar ANTES de enviar o pedido inteiro. codigoTabela/
// percentualDesconto agora vêm do popup de item (unificação da tela de
// criar pedido com o popup de confirmação, referência do usuário).
export async function calcularItem(
  produtoId: string,
  metrosDesejados: number,
  opcoes: { codigoTabela?: string; percentualDesconto?: number } = {},
): Promise<{ status: "sucesso"; resultado: ResultadoCalculoQuantidadeDto } | { status: "erro"; mensagem: string }> {
  try {
    const resultado = await apiFetch<ResultadoCalculoQuantidadeDto>(
      `/produtos/${encodeURIComponent(produtoId)}/calcular`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrosDesejados, ...opcoes }),
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

export interface SimulacaoDescontoDto {
  necessitaAprovacao: boolean;
  aprovadorEsperado?: { id: string; nome: string | null };
}

// Aviso PROATIVO de que o desconto do item vai exigir aprovação, antes de
// confirmar o pedido (POST /pedidos/simular-desconto, sem efeito colateral
// nenhum - nunca cria SolicitacaoDesconto). Pedido do usuário (2026-09-30) -
// o formulário reagia só depois do envio, sem avisar durante a digitação.
export async function simularDesconto(
  percentualDesconto: number,
): Promise<{ status: "sucesso"; resultado: SimulacaoDescontoDto } | { status: "erro" }> {
  try {
    const resultado = await apiFetch<SimulacaoDescontoDto>("/pedidos/simular-desconto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ percentualDesconto }),
      cache: "no-store",
    });
    return { status: "sucesso", resultado };
  } catch {
    // Aviso é só um extra informativo - se a simulação falhar, o envio de
    // verdade continua o juiz final (mesmo critério do mobile).
    return { status: "erro" };
  }
}

// Contatos já sincronizados do cliente (dropdown "Selecionar contato") -
// GET /clientes/:id já traz `contatos` embutido, sem endpoint novo.
export async function obterContatosCliente(clienteId: string): Promise<ContatoClienteDto[]> {
  try {
    const cliente = await apiFetch<{ contatos: ContatoClienteDto[] }>(
      `/clientes/${encodeURIComponent(clienteId)}`,
      { cache: "no-store" },
    );
    return cliente.contatos;
  } catch {
    return [];
  }
}

// Tabelas de preço associadas ao cliente (popup automático ao selecionar
// o cliente, ver criar-pedido-form.tsx) - GET /clientes/:id/tabelas-preco
// já existia (Bloco 1), reaproveitado aqui.
export async function listarTabelasPrecoCliente(clienteId: string): Promise<string[]> {
  try {
    const resultado = await apiFetch<{ codigos: string[] }>(
      `/clientes/${encodeURIComponent(clienteId)}/tabelas-preco`,
      { cache: "no-store" },
    );
    return resultado.codigos;
  } catch {
    return [];
  }
}

// Preço do produto em cada tabela do cliente (popup de item) - GET
// /produtos/:id/precos?clienteId= já existia (Bloco 1), reaproveitado aqui.
export async function listarPrecosPorTabela(
  produtoId: string,
  clienteId: string,
): Promise<{ codigo: string; preco: string | null }[]> {
  try {
    const resultado = await apiFetch<{ tabelas: { codigo: string; preco: string | null }[] }>(
      `/produtos/${encodeURIComponent(produtoId)}/precos?clienteId=${encodeURIComponent(clienteId)}`,
      { cache: "no-store" },
    );
    return resultado.tabelas;
  } catch {
    return [];
  }
}

interface CriarContatoInput {
  nome: string;
  telefoneDdd?: string;
  telefoneNumero?: string;
  email?: string;
  funcao?: string;
}

// Contato criado por nós (popup "Adicionar contato") - nunca sincroniza
// pro WK Radar (ver ContatoCliente.criadoLocalmente no backend).
export async function criarContatoCliente(
  clienteId: string,
  input: CriarContatoInput,
): Promise<{ status: "sucesso"; contato: ContatoClienteDto } | { status: "erro"; mensagem: string }> {
  try {
    const contato = await apiFetch<ContatoClienteDto>(
      `/clientes/${encodeURIComponent(clienteId)}/contatos`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        cache: "no-store",
      },
    );
    return { status: "sucesso", contato };
  } catch (error) {
    return {
      status: "erro",
      mensagem: error instanceof ApiError ? extrairMensagem(error) : "Erro desconhecido ao adicionar contato.",
    };
  }
}

interface CriarPedidoItemInput {
  produtoId: string;
  metrosDesejados: number;
  percentualDesconto: number;
  observacoes?: string;
}

interface CriarPedidoInput {
  clienteId: string;
  formaPagamentoId: string;
  condicaoPagamentoId: string;
  codigoTabelaPreco?: string;
  contatoId?: string;
  vendedorId?: string;
  // Épico 4 (config-aba-orcamento.jpg) - salva como rascunho em vez de
  // enviar ao ERP.
  salvarComoOrcamento?: boolean;
  // Observações do PEDIDO inteiro (2026-09-21) - preenchida uma vez no
  // formulário principal, não mais por item (ver histórico: o campo
  // "Observações" da tela já existia, mas nunca era enviado no payload -
  // corrigido junto com esta mudança).
  observacoes?: string;
  itens: CriarPedidoItemInput[];
}

interface CriarPedidoResultadoDto {
  status: "ENVIADO" | "AGUARDANDO_APROVACAO" | "ORCAMENTO";
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
