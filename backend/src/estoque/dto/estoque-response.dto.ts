// Ate a sincronizacao de saldo de estoque (ver SaldoEstoqueSyncStrategy),
// itens vinham do relatorio WK BI "por Local de Estocagem" (varias linhas
// por produto). Depois passaram a ser sempre no maximo 1 item fake
// (localCodigo/localNome/lote/fabricadoEm null, so pra caber o saldo
// consolidado no mesmo shape). Agora `itens` volta a ser a lista REAL de
// lotes/local (consulta on-demand ao WK BI, tempo real - ver skill
// wk-radar-bi-client, Padrao 1), e os dois numeros de estoque (fisico
// bruto somado dos lotes vs. disponivel liquido de pedidos comprometidos)
// aparecem como campos proprios, rotulados, porque sao conceitos
// DIFERENTES e nao devem ser confundidos nem somados entre si (confirmado
// via teste real: nao batem, por design - ver achados na skill).
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
  // Lotes reais por local de estocagem (WK BI/Executivo.svc, consultado em
  // tempo real a cada requisicao - nao sincronizado, nao persistido).
  itens: EstoqueItemDto[];
  // Soma de itens[].quantidade - saldo fisico bruto, sem considerar pedido
  // comprometido/reservado. Null so quando a consulta ao WK BI falhou (ver
  // EstoqueService) - lista vazia de itens ja resulta em "0.0000", nao null.
  quantidadeFisicaTotal: string | null;
  // Saldo liquido de pedidos comprometidos em aberto (Estoque.svc, ja
  // sincronizado na tabela local SaldoEstoque) - pode ser MENOR que
  // quantidadeFisicaTotal (ha pedido reservando saldo) e, no limite,
  // negativo (comprometido excede o fisico). Null quando o produto existe
  // mas nunca teve saldo sincronizado.
  quantidadeDisponivel: string | null;
  // Momento da ultima sincronizacao de quantidadeDisponivel (nao da
  // consulta em si, que e' sempre em tempo real pros lotes) - null quando
  // nunca sincronizado.
  atualizadoEm: string | null;
}
