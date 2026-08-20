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
