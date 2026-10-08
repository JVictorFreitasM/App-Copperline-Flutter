import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { TIPOS_PROVEDOR_API, type TipoProvedorApi } from '../provedor-api.types';

export class CriarProvedorApiDto {
  @IsIn(TIPOS_PROVEDOR_API)
  tipo!: TipoProvedorApi;

  // A combinacao tipo/formato e' validada no service (lista fechada por tipo).
  @IsString()
  @MaxLength(40)
  formato!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  rotulo!: string;

  @IsString()
  @MaxLength(500)
  urlBase!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  token?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  limiteRequisicoes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(86400)
  janelaSegundos?: number;
}

export class AtualizarProvedorApiDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  rotulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  urlBase?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  token?: string;

  @ValidateIf((_, valor) => valor !== null && valor !== undefined)
  @IsInt()
  @Min(1)
  @Max(100000)
  limiteRequisicoes?: number | null;

  @ValidateIf((_, valor) => valor !== null && valor !== undefined)
  @IsInt()
  @Min(1)
  @Max(86400)
  janelaSegundos?: number | null;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}

export class ReordenarProvedoresApiDto {
  @IsIn(TIPOS_PROVEDOR_API)
  tipo!: TipoProvedorApi;

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids!: string[];
}
