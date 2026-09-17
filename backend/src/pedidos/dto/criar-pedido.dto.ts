import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CriarPedidoItemDto {
  @IsUUID()
  produtoId!: string;

  @IsNumber()
  @IsPositive()
  metrosDesejados!: number;

  // Desconto por item (OS-pendentes-claude-code.md) - substitui o antigo
  // percentualDesconto unico do pedido inteiro (ver CriarPedidoDto).
  @IsNumber()
  @Min(0)
  @Max(100)
  percentualDesconto!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoes?: string;
}

export class CriarPedidoDto {
  @IsUUID()
  clienteId!: string;

  @IsUUID()
  formaPagamentoId!: string;

  @IsUUID()
  condicaoPagamentoId!: string;

  // Tabela de precos escolhida no popup (ver Pedido.codigoTabelaPreco) -
  // omitido cai no fallback do singleton global de sempre
  // (ConfiguracaoTabelaPrecoService), mesmo comportamento de antes desta OS.
  @IsOptional()
  @IsString()
  codigoTabelaPreco?: string;

  // Contato do cliente escolhido na criacao - precisa pertencer ao
  // clienteId acima (checado no service, mesmo criterio IDOR do resto do
  // modulo).
  @IsOptional()
  @IsUUID()
  contatoId?: string;

  // Em nome de qual vendedor da PROPRIA equipe criar o pedido (so'
  // supervisor/gerente pode usar isso - checado contra
  // VendedorEscopoService no service, nunca confiar so' no DTO). Omitido =
  // usa o vendedor do proprio usuario logado (comportamento de sempre).
  @IsOptional()
  @IsUUID()
  vendedorId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CriarPedidoItemDto)
  itens!: CriarPedidoItemDto[];
}
