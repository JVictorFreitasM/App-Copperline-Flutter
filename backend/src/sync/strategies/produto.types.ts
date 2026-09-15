// Subconjunto do ReadProdutoDto (Radar.API, GET /empresarial/v1/produto)
// que o sistema efetivamente usa - schema completo confirmado contra o
// swagger.json do ambiente de testes (ver skill wk-radar-client). kit[] e
// blocos fiscais extensos ficam fora (OS 06, "Fora de escopo").
export type TipoProdutoWkRadar =
  'Invalido' | 'Classe' | 'Proprio' | 'Terceiros' | 'Kit';

export interface WkRadarProdutoReferenciaGrade {
  idItemGrade1?: string | null;
  idItemGrade2?: string | null;
  idItemGrade3?: string | null;
  referencia?: string | null;
}

export interface WkRadarProdutoComplemento {
  gtin?: string | null;
}

// dimensoes.comprimento (OS-BACKEND-24) - usado por
// calcularQuantidadePedido pra produtos POC/KM (comprimento por
// peca/unidade fechada). unidadeMedidaComprimento e' enum livre no Radar
// (swagger so mostra "Invalido" como placeholder de exemplo, valores
// reais NAO confirmados contra o ambiente de testes) - so tratamos como
// metros quando o valor for exatamente "Metro" (ver
// produto.sync.ts:mapearComprimentoMetros); qualquer outra coisa fica
// null, nunca interpretado incorretamente.
export interface WkRadarProdutoDimensoes {
  comprimento?: number | null;
  unidadeMedidaComprimento?: string | null;
}

export interface WkRadarProduto {
  id: string;
  codigoIntegrador?: string | null;
  codigo?: string | null;
  nome?: string | null;
  descricao?: string | null;
  tipo?: TipoProdutoWkRadar | null;
  inativo: boolean;
  precoVenda?: number | null;
  idGrade1?: string | null;
  idGrade2?: string | null;
  idGrade3?: string | null;
  referenciasGrade?: WkRadarProdutoReferenciaGrade[] | null;
  complemento?: WkRadarProdutoComplemento | null;
  dimensoes?: WkRadarProdutoDimensoes | null;
  // pesoLiquido/pesoBruto (OS-novas-implementacoes.md Bloco 3) - campos de
  // NIVEL SUPERIOR no payload real do Radar (confirmado empiricamente,
  // GET /empresarial/v1/produto com Fields[] - NAO ficam dentro de
  // `dimensoes`, ao contrario de comprimento). unidadeMedidaPeso* e' o
  // enum irmao de cada um (valores observados: "Nenhum"/"kg").
  pesoLiquido?: number | null;
  unidadeMedidaPesoLiquido?: string | null;
  pesoBruto?: number | null;
  unidadeMedidaPesoBruto?: string | null;
}

export interface ProdutoMapeado {
  idExternoErp: string;
  codigoIntegrador: string | null;
  codigo: string | null;
  nome: string | null;
  descricao: string | null;
  tipo: string | null;
  inativo: boolean;
  precoVenda: number | null;
  gtin: string | null;
  idGrade1: string | null;
  idGrade2: string | null;
  idGrade3: string | null;
  referenciasGrade: WkRadarProdutoReferenciaGrade[];
  comprimentoMetros: number | null;
  pesoLiquidoKg: number | null;
  pesoBrutoKg: number | null;
}
