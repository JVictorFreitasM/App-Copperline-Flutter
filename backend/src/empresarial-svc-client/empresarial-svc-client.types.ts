// Formato bruto de um item de tabela de preco, como o Empresarial.svc
// devolve (chaves em PascalCase). Valores numericos vem como string em
// formato BR (ex: "2.600,02") - parse fica em parse-decimal-br.ts, nao
// aqui. Datas vem como "DD/MM/AAAA HH:mm", com "00/00/0000 00:00" como
// sentinel de "sem data" - parse fica em parse-data-br.ts.
export interface ItemTabelaPrecoBruto {
  CodigoItem: string;
  Preco: string;
  PrecoPromocional: string;
  QuantidadeMinima: string;
  QuantidadeMaxima: string;
  PercentualDescontoMaximo: string;
  ValorDescontoMaximo: string;
  DataUltimoReajuste: string;
  DataInicioPromocao: string;
  DataFimPromocao: string;
}

export interface TabelaPrecoBruta {
  Id: string;
  Codigo: string;
  Ativa: boolean;
  ItensTabelaPreco: ItemTabelaPrecoBruto[];
}
