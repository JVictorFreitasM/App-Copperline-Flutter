import { IsDateString, IsOptional } from 'class-validator';

// Compartilhado por vendas/ranking/notas-fiscais (OS-BACKEND-17) - mesmo
// par de campos que ja se repetia em listar-pedidos-query.dto.ts sem
// abstracao; primeira vez que 3+ endpoints usam o mesmo filtro de periodo
// ao mesmo tempo, entao vale extrair (mesmo padrao de PaginationQueryDto).
export class PeriodoQueryDto {
  @IsOptional()
  @IsDateString()
  dataInicial?: string;

  @IsOptional()
  @IsDateString()
  dataFinal?: string;
}
