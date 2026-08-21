// Formato bruto de um item de saldo, como o Estoque.svc devolve (chaves em
// PascalCase, exatamente como no XML). QuantidadeDisponivel vem como
// string em formato BR (ex: "14,5830"), nunca number - parse fica em
// parse-decimal-br.ts, nao aqui.
export interface SaldoProdutoBruto {
  codigoProduto: string;
  quantidadeDisponivel: string;
}
