import { IsNumber, Max, Min } from 'class-validator';

export class AtualizarConfiguracaoDescontoDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  limitePercentual!: number;
}
