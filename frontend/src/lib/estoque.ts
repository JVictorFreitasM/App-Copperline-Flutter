// Mesmo shape de backend/src/estoque/dto/estoque-response.dto.ts
// (EstoqueItemDto/EstoqueConsultaDto) - duplicado aqui por não haver
// pacote compartilhado entre front e back. Combina DUAS fontes diferentes
// de estoque, que não devem ser confundidas nem somadas entre si
// (confirmado via teste real contra o WK Radar, ver skill
// wk-radar-bi-client): `itens`/`quantidadeFisicaTotal` vêm dos lotes reais
// por local de estocagem, consultados em tempo real a cada requisição
// (Executivo.svc); `quantidadeDisponivel` vem do saldo já sincronizado,
// líquido de pedido comprometido em aberto (Estoque.svc) - pode ser bem
// menor (ou até negativo) que a soma física dos lotes.
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
  // Soma de itens[].quantidade - saldo físico bruto, sem considerar
  // reserva/comprometido.
  quantidadeFisicaTotal: string | null;
  // Saldo líquido de pedido comprometido em aberto - null quando o produto
  // existe mas nunca teve saldo sincronizado.
  quantidadeDisponivel: string | null;
  // Momento da última sincronização de quantidadeDisponivel (não da
  // consulta em si, que é sempre em tempo real pros lotes) - null quando
  // nunca sincronizado.
  atualizadoEm: string | null;
}

// Mesmo shape de backend/src/estoque/dto/estoque-mais-pedidos.dto.ts
// (ProdutoMaisPedidoDto, GET /estoque/mais-pedidos) - ranking por
// quantidade total pedida (não valor), pra priorizar reposição de
// estoque.
export interface ProdutoMaisPedidoDto {
  produtoId: string;
  nome: string | null;
  codigo: string;
  quantidadeTotalPedida: number;
  quantidadeDisponivel: string | null;
}
