import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

const TIPOS_CADENCIA = [
  'INCREMENTAL',
  'INCREMENTAL_NOTURNO',
  'JANELA_FIXA_DIARIA',
  'CONFIGURAVEL',
] as const;

export class AtualizarConfiguracaoSyncDto {
  @IsIn(TIPOS_CADENCIA)
  tipoCadencia!: (typeof TIPOS_CADENCIA)[number];

  // Obrigatorio so quando tipoCadencia usa intervalo (INCREMENTAL/
  // CONFIGURAVEL) - ver construir-repeat-options.ts.
  @ValidateIf((dto) => dto.tipoCadencia === 'INCREMENTAL' || dto.tipoCadencia === 'CONFIGURAVEL')
  @IsInt()
  @Min(1)
  intervaloMinutos?: number;

  // Obrigatorio so quando tipoCadencia usa horario fixo
  // (INCREMENTAL_NOTURNO/JANELA_FIXA_DIARIA).
  @ValidateIf(
    (dto) =>
      dto.tipoCadencia === 'INCREMENTAL_NOTURNO' || dto.tipoCadencia === 'JANELA_FIXA_DIARIA',
  )
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'horarioFixo deve estar no formato "HH:mm"' })
  horarioFixo?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  diasSemana?: number[];
}
