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

  // Escolhidos pelo vendedor na criacao (catalogos sincronizados, ver
  // GET /formas-pagamento e GET /condicoes-pagamento) - persistidos no
  // pedido independente do envio ao ERP acontecer na hora ou nao (ver
  // comentario em Pedido.formaPagamentoId, schema.prisma).
  @IsUUID()
  formaPagamentoId!: string;

  @IsUUID()
  condicaoPagamentoId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CriarPedidoItemDto)
  itens!: CriarPedidoItemDto[];
}
