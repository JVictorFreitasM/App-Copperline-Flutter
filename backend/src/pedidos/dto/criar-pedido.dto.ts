import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsPositive,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CriarPedidoItemDto {
  @IsUUID()
  produtoId!: string;

  @IsNumber()
  @IsPositive()
  metrosDesejados!: number;
}

export class CriarPedidoDto {
  @IsUUID()
  clienteId!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentualDesconto!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CriarPedidoItemDto)
  itens!: CriarPedidoItemDto[];
}
