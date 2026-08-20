import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Paginacao da NOSSA API (page/limit sobre o dado ja persistido no
// Postgres) - nao confundir com a paginacao por janela de tempo do lado do
// WK Radar (ja resolvida na sincronizacao, ver sync/paginacao-por-janela.ts).
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
