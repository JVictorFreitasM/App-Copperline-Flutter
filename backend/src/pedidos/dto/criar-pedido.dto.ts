import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
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
  // Chave de idempotencia gerada no APP por tentativa de envio (opcional -
  // web nao manda). Reenviar o mesmo idLocal (ex: o app desistiu da resposta
  // por timeout e reenvia pela fila offline) devolve o pedido ja criado em
  // vez de criar outro. Ver CriarPedidoIdempotenteService.
  @IsOptional()
  @IsUUID()
  idLocal?: string;

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

  // Posição no momento do registro (Epico 4, config-aba-rastreio.jpg -
  // "Distância máxima do cliente para registro de pedido") - so'
  // validado quando essa config tem um valor definido (ver
  // CriarPedidoService.validarDistanciaRegistro).
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  // Epico 4 (config-aba-orcamento.jpg) - salva como rascunho em vez de
  // enviar ao ERP (ver CriarPedidoService.criar). Omitido = comportamento
  // de sempre (cria pedido de verdade).
  @IsOptional()
  @IsBoolean()
  salvarComoOrcamento?: boolean;

  // Observacoes do PEDIDO inteiro (2026-09-21, pedido do usuario) - campo
  // unico preenchido uma vez na criacao, nao por item (ver
  // CriarPedidoItemDto.observacoes acima, conceito separado ja existente).
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CriarPedidoItemDto)
  itens!: CriarPedidoItemDto[];
}
