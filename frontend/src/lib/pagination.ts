// Mesmo shape de backend/src/common/pagination.ts (PaginatedResult) -
// duplicado aqui por não haver pacote compartilhado entre front e back
// (mesmo padrão de CurrentUser em auth.ts).
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
