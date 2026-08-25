import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsNumber,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

// Teto de seguranca (nao um limite de negocio - a cadencia de captura fica
// do lado do app, OS-MOBILE-20) - so recusa um lote absurdamente grande de
// uma vez, indicio de bug no app (ex: loop de captura sem debounce), nao
// um cenario de uso legitimo mesmo em dias offline longos.
export const TAMANHO_MAXIMO_LOTE = 2000;

export class PontoRastreioDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  // Timestamp de quando o ponto foi CAPTURADO no dispositivo - nunca o
  // momento do envio (criterio de aceite: lote enviado offline e depois
  // online preserva o timestamp original).
  @IsISO8601()
  timestamp!: string;
}

export class EnviarLoteRastreioDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(TAMANHO_MAXIMO_LOTE)
  @ValidateNested({ each: true })
  @Type(() => PontoRastreioDto)
  pontos!: PontoRastreioDto[];
}
