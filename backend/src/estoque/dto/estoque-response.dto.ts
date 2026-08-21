// Ate a sincronizacao de saldo de estoque (ver SaldoEstoqueSyncStrategy),
// itens vinham do relatorio WK BI "por Local de Estocagem" (varias linhas
// por produto). O Estoque.svc (fonte atual) retorna saldo CONSOLIDADO por
// produto, sem quebra por local/lote (fora de escopo, ver decisoes
// pendentes da OS) - por isso sempre no maximo 1 item agora, com
// localCodigo/localNome/lote/fabricadoEm sempre null. O shape (lista) foi
// mantido em vez de virar um campo unico pra nao quebrar front/mobile, que
// ja iteram `itens` esperando 0 ou 1+ elementos.
export interface EstoqueItemDto {
  localCodigo: string | null;
  localNome: string | null;
  lote: string | null;
  fabricadoEm: string | null;
  quantidade: string;
}

export interface EstoqueConsultaDto {
  produtoId: string;
  codigo: string;
  itens: EstoqueItemDto[];
  // Quando ha um saldo sincronizado: momento da ultima sincronizacao bem
  // sucedida (nao da consulta em si) - transparencia de que o dado pode
  // estar desatualizado (ver criterio de aceite da OS de sync de saldo).
  // null quando o produto existe mas nunca teve saldo sincronizado (fora
  // do filtro Estoque Proprio, ou sync ainda nao rodou).
  atualizadoEm: string | null;
}
