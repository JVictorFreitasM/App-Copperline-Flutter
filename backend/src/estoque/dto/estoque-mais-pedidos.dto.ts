import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class EstoqueMaisPedidosQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limite: number = 10;
}

export interface ProdutoMaisPedidoDto {
  produtoId: string;
  nome: string | null;
  codigo: string;
  quantidadeTotalPedida: number;
  quantidadeDisponivel: string | null;
}
