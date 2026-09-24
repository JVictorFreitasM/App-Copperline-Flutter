import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class AtualizarChaveLlmDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  rotulo?: string;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}
