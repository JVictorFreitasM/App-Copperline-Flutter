import { IsNumber, IsPositive } from 'class-validator';

export class CalcularQuantidadeDto {
  @IsNumber()
  @IsPositive()
  metrosDesejados!: number;
}
