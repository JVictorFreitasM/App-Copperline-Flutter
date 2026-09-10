// Mesmo shape de backend/src/tabelas-preco/dto/tabela-preco-response.dto.ts
// - duplicado aqui por não haver pacote compartilhado entre front e back
// (mesmo padrão de ClienteResumoDto em clientes.ts).
export interface TabelaPrecoResumoDto {
  id: string;
  codigo: string;
  ativa: boolean;
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

// Mesmo shape de
// backend/src/tabelas-preco/configuracao-tabela-preco.service.ts
// (ConfiguracaoTabelaPrecoDto) - qual codigo o sync deve acompanhar
// (pedido do usuário: "pegue apenas a tabela 110, o sync das outras só
// vai acontecer se ela for selecionada"). Escolher aqui TAMBÉM define a
// fonte de preço "oficial" pro resto do sistema - uma única decisão.
export interface ConfiguracaoTabelaPrecoDto {
  codigoSelecionado: string | null;
  atualizadoEm: string;
}
