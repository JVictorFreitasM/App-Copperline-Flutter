import { IsBoolean } from 'class-validator';

export class AtualizarConfiguracaoOrcamentoDto {
  @IsBoolean()
  habilitarCriacaoOrcamento!: boolean;

  @IsBoolean()
  permitirVendedorTransformarEmPedido!: boolean;

  @IsBoolean()
  criarPedidoSugeridoComoOrcamento!: boolean;

  @IsBoolean()
  permitirAlteracaoVendedorOrcamentoCriado!: boolean;

  @IsBoolean()
  permitirItensRepetidos!: boolean;
}
