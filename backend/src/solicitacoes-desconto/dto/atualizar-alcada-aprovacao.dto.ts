import { IsBoolean, IsNumber, Max, Min } from 'class-validator';

// Usado so pelo endpoint web (admin/configuracoes/alcada-aprovacao,
// requireRole('admin')) - diferente de AtualizarConfiguracaoDescontoDto
// (endpoint ops, ApiKeyGuard, so limitePercentual), este sempre exige os
// 4 campos da aba "Alcada de Aprovacao" (config-aba-aprovacao.jpg).
export class AtualizarAlcadaAprovacaoDto {
  @IsBoolean()
  habilitarAprovacaoPorAlcada!: boolean;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentualAlcadaGerencial!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentualAlcadaSupervisao!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  limitePercentual!: number;
}
