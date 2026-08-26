// Mesmo shape de backend/src/produtos/dto/produto-response.dto.ts
// (ProdutoResumoDto) - duplicado aqui por não haver pacote compartilhado
// entre front e back (mesmo padrão de ClienteResumoDto em clientes.ts).
export interface ProdutoResumoDto {
  id: string;
  idExternoErp: string;
  codigo: string | null;
  nome: string | null;
  tipo: string | null;
  inativo: boolean;
  precoVenda: string | null;
  gtin: string | null;
  incompleto: boolean;
  sincronizadoEm: string;
}

// Sem "blocos fiscais" (NCM, CST, tributos etc.) - esses campos não
// existem no modelo Produto sincronizado (schema.prisma), nem `descricao`
// é exposta pelo ProdutoResumoDto/ProdutoDetalheDto do backend. O detalhe
// mostra o que de fato existe além do resumo: a grade.
export interface ProdutoDetalheDto extends ProdutoResumoDto {
  idGrade1: string | null;
  idGrade2: string | null;
  idGrade3: string | null;
  referenciasGrade: unknown;
  // OS-BACKEND-24/OS-WEB-22 - normalmente null hoje: a regra de
  // classificação automática POC/RET/KM ainda não foi definida (ver
  // PENDENCIA em schema.prisma), o campo só existe pronto pra quando essa
  // regra existir.
  tipoVenda: TipoVendaProduto | null;
  comprimentoMetros: string | null;
}

// Enum TipoVendaProduto do backend (schema.prisma) - usado por
// calcularQuantidadePedido (domain/calculo-quantidade-pedido.ts) pra
// decidir como converter metros desejados em quantidade de venda: POC
// arredonda pra peça inteira, RET aceita fracionário (corte sob medida),
// KM exige múltiplo exato do comprimento cadastrado.
export type TipoVendaProduto = "POC" | "RET" | "KM";

const ROTULOS_TIPO_VENDA: Record<TipoVendaProduto, string> = {
  POC: "Peça (POC)",
  RET: "Retalho (RET)",
  KM: "Quilômetro (KM)",
};

export function rotuloTipoVenda(tipoVenda: TipoVendaProduto | null): string {
  if (!tipoVenda) {
    return "Não configurado";
  }
  return ROTULOS_TIPO_VENDA[tipoVenda];
}

export type UnidadeCalculo = "PECA" | "METRO" | "KM";

const ROTULOS_UNIDADE_CALCULO: Record<UnidadeCalculo, string> = {
  PECA: "peça(s)",
  METRO: "metro(s)",
  KM: "unidade(s) fechada(s)",
};

export function rotuloUnidadeCalculo(unidade: UnidadeCalculo): string {
  return ROTULOS_UNIDADE_CALCULO[unidade];
}

// Mesmo shape de
// backend/src/produtos/domain/calculo-quantidade-pedido.ts
// (ResultadoCalculoQuantidade, retorno de POST /produtos/:id/calcular) -
// o front NUNCA recalcula isso, só formata o que o backend devolveu
// (critério de aceite da OS-WEB-22: "mesma fonte de verdade, sem duplicar
// lógica no front").
export interface ResultadoCalculoQuantidadeDto {
  quantidade: number;
  unidade: UnidadeCalculo;
  valorTotal: number;
}

// Valores possíveis vêm do enum TipoProduto do backend (schema.prisma) -
// INVALIDO/CLASSE/PROPRIO/TERCEIROS/KIT. Não existe uma categoria
// "Embalagens" no modelo de dados atual.
const ROTULOS_TIPO: Record<string, string> = {
  PROPRIO: "Próprio",
  TERCEIROS: "Terceiros",
  KIT: "Kit",
  CLASSE: "Classe",
  INVALIDO: "Inválido",
};

export function rotuloTipoProduto(tipo: string | null): string {
  if (!tipo) {
    return "—";
  }
  return ROTULOS_TIPO[tipo] ?? tipo;
}
