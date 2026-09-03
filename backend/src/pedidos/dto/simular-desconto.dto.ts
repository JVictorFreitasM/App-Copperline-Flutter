import { IsNumber, Max, Min } from 'class-validator';

// OS-BACKEND-22-A - mesmo campo/validacao de CriarPedidoDto.percentualDesconto
// (criar-pedido.dto.ts), so que aqui e' o unico campo (simulacao nao recebe
// cliente/itens - so precisa saber se ESSE percentual, pra ESSE vendedor
// logado, precisaria de aprovacao).
export class SimularDescontoDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  percentualDesconto!: number;
}
