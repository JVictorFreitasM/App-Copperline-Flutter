// Mesmo shape de backend/src/estoque/dto/estoque-response.dto.ts
// (EstoqueItemDto/EstoqueConsultaDto) - duplicado aqui por não haver
// pacote compartilhado entre front e back.
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
}
