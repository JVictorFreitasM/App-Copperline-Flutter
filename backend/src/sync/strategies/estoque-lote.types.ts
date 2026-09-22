// Nomes de campo confirmados via chamada real ao WK BI (skill
// wk-radar-bi-client, modelo "Saldo de Produtos por Local de Estocagem -
// BOT") - com ponto/espaco, por isso via indice em vez de dot notation.
// Nao e' um contrato estavel da API: vem do modelo do relatorio salvo no
// WK Radar, poderia mudar se o modelo for alterado do lado de la.
export interface LinhaSaldoEstoqueWkBi {
  'Cod.'?: string;
  Lote?: string;
  'Fabricado Em'?: string;
  'Código Local'?: string;
  'Nome do Local'?: string;
  'Qtde Estoque'?: string;
}

// fetch() agrupa as linhas planas do relatorio por produto (CodProdutos=""
// traz TODOS de uma vez, sem quebra por produto na resposta) - um
// "registro" bruto pra este sync e' TODAS as linhas de um produto, nao uma
// linha isolada, pro mesmo motivo de TabelaPrecoSyncStrategy (upsert()
// precisa ver o conjunto completo de um produto pra decidir quais lotes
// antigos sumiram e devem ser removidos - full refresh por produto, nao
// upsert incremental solto).
export interface EstoqueLoteBrutoAgrupado {
  codigoProduto: string;
  linhas: LinhaSaldoEstoqueWkBi[];
}

export interface EstoqueLoteItemMapeado {
  lote: string;
  localCodigo: string;
  localNome: string;
  quantidade: string;
  fabricadoEm: Date | null;
}

export interface EstoqueLoteMapeado {
  codigoProduto: string;
  itens: EstoqueLoteItemMapeado[];
}
