// Mesmo shape de backend/src/tabelas-preco/dto/tabela-preco-response.dto.ts
// - duplicado aqui por não haver pacote compartilhado entre front e back
// (mesmo padrão de ClienteResumoDto em clientes.ts).
export interface TabelaPrecoResumoDto {
  id: string;
  codigo: string;
  ativa: boolean;
  // "Tabela padrão" (pedido do usuário: "possibilidade de trocar a
  // tabela") - qual tabela é a fonte de preço oficial pro resto do
  // sistema, editável via PATCH /admin/tabelas-preco/:id/padrao.
  padrao: boolean;
  quantidadeItens: number;
  sincronizadoEm: string;
}

export interface ItemTabelaPrecoDto {
  id: string;
  codigoItem: string;
  preco: string;
  precoPromocional: string | null;
  quantidadeMinima: string;
  quantidadeMaxima: string;
  percentualDescontoMaximo: string;
  valorDescontoMaximo: string;
  dataUltimoReajuste: string | null;
  dataInicioPromocao: string | null;
  dataFimPromocao: string | null;
}
