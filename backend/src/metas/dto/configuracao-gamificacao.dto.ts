import { IsBoolean } from 'class-validator';

export class AtualizarConfiguracaoGamificacaoDto {
  @IsBoolean()
  rankingVisivelParaVendedor!: boolean;
}
