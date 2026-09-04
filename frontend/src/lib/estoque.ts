// Mesmo shape de backend/src/estoque/dto/estoque-response.dto.ts
// (EstoqueItemDto/EstoqueConsultaDto) - duplicado aqui por não haver
// pacote compartilhado entre front e back. Estoque.svc (fonte atual, ver
// comentário no DTO do backend) devolve saldo CONSOLIDADO por produto, sem
// quebra por local de estocagem - localCodigo/localNome/lote/fabricadoEm
// ficam sempre null por enquanto, `itens` nunca passa de 1 elemento (o
// shape de lista foi mantido só pra não quebrar front/mobile).
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
  // Momento da última sincronização bem-sucedida do saldo (não da consulta
  // em si) - null quando o produto existe mas nunca teve saldo sincronizado.
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
