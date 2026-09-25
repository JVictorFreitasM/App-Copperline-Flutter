import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class AtualizarConfiguracaoLlmDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  provedor?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  modelo?: string;

  @IsOptional()
  @IsBoolean()
  fallbackAtivo?: boolean;
}
