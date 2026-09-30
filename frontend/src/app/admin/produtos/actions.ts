"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, ApiError } from "@/lib/api";
import type { PaginatedResult } from "@/lib/pagination";
import type { ProdutoDetalheDto, ResultadoImagensLoteDto } from "@/lib/produtos";
import type { EstadoEdicaoManual, EstadoUploadLote } from "./estado-produtos-admin";

// Protegido por requireRole('admin') via MiddlewareConsumer (ver
// produtos.module.ts) - mesmo padrão de enviarImagemProduto
// (produtos/[id]/actions.ts), so que em massa: FormData com varios
// arquivos sob o MESMO campo "imagens" (o browser já monta isso sozinho
// com <input type="file" multiple>, sem precisar iterar aqui). Nome de
// cada arquivo (sem extensão) = Produto.codigo - casamento feito no
// backend (ProdutoManualService.salvarImagensEmLote).
export async function enviarImagensEmLote(
  _estadoAnterior: EstadoUploadLote,
  formData: FormData,
): Promise<EstadoUploadLote> {
  const arquivos = formData.getAll("imagens").filter((valor) => valor instanceof File && valor.size > 0);
  if (arquivos.length === 0) {
    return { erro: "Selecione ao menos um arquivo de imagem.", resultado: null };
  }

  try {
    const resultado = await apiFetch<ResultadoImagensLoteDto>("/admin/produtos/imagens-em-lote", {
      method: "POST",
      body: formData,
      cache: "no-store",
    });
    return { erro: null, resultado };
  } catch (error) {
    return {
      erro: error instanceof ApiError ? error.message : "Erro desconhecido ao enviar as imagens.",
      resultado: null,
    };
  }
}

export interface ProdutoBuscaImagem {
  id: string;
  nome: string | null;
  codigo: string | null;
}

// Upload individual (movido de produtos/[id] pro admin, pedido do usuário
// 2026-09-29 - "área pra adicionar imagem individualmente" dentro de
// /admin/produtos) - busca por nome OU código em paralelo, mesmo padrão
// de buscarProdutos (pedidos/novo/actions.ts), sem reaproveitar aquele
// (vive em outra feature/rota, e o formato de retorno aqui é diferente -
// precisa de id/nome/codigo separados, não um label já montado).
export async function buscarProdutosParaImagem(query: string): Promise<ProdutoBuscaImagem[]> {
  const termo = query.trim();
  if (!termo) return [];

  const buscarPor = async (campo: "nome" | "codigo"): Promise<ProdutoBuscaImagem[]> => {
    try {
      const resultado = await apiFetch<PaginatedResult<ProdutoBuscaImagem>>(
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
  const produtos: ProdutoBuscaImagem[] = [];
  for (const produto of [...porNome, ...porCodigo]) {
    if (vistos.has(produto.id)) continue;
    vistos.add(produto.id);
    produtos.push(produto);
  }
  return produtos;
}

// Detalhe do produto selecionado na busca acima - só pra saber se já tem
// imagem (temImagem) e montar a URL de preview; leitura aberta (GET
// /produtos/:id, mesmo endpoint da tela pública), sem checagem de role
// extra aqui (o upload em si, abaixo, é que exige admin no backend).
export async function obterProdutoParaImagem(produtoId: string): Promise<ProdutoDetalheDto | null> {
  try {
    return await apiFetch<ProdutoDetalheDto>(`/produtos/${encodeURIComponent(produtoId)}`, {
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

// Movido de produtos/[id]/actions.ts (pedido do usuário, 2026-09-29) -
// upload individual agora vive só em /admin/produtos, junto do upload em
// massa. Campos que NÃO vêm do WK Radar (imagem), editável só por admin,
// via POST /admin/produtos/:id/imagem (backend já valida role admin via
// requireRole, ver produtos.module.ts).
export async function enviarImagemProduto(
  produtoId: string,
  _estadoAnterior: EstadoEdicaoManual,
  formData: FormData,
): Promise<EstadoEdicaoManual> {
  const imagem = formData.get("imagem");
  if (!(imagem instanceof File) || imagem.size === 0) {
    return { erro: "Selecione uma imagem.", sucesso: null };
  }

  try {
    await apiFetch<ProdutoDetalheDto>(`/admin/produtos/${encodeURIComponent(produtoId)}/imagem`, {
      method: "POST",
      body: formData,
      cache: "no-store",
    });
  } catch (error) {
    return {
      erro: error instanceof ApiError ? error.message : "Erro desconhecido ao enviar a imagem.",
      sucesso: null,
    };
  }

  revalidatePath("/admin/produtos");
  return { erro: null, sucesso: "Imagem atualizada." };
}

// Movido de produtos/[id]/actions.ts (pedido do usuário, 2026-09-29) -
// "Dados administrativos" agora vive inteiro em /admin/produtos. Campos
// que NAO vem do WK Radar (precoFabricacao/tipoAcondicionamentoId),
// editaveis so por admin, via PATCH /admin/produtos/:id (backend ja
// valida role admin via requireRole, ver produtos.module.ts).
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

  revalidatePath("/admin/produtos");
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

  revalidatePath("/admin/produtos");
  return { erro: null, sucesso: "Tipo de acondicionamento atualizado." };
}
