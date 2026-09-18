import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

// Teto de seguranca (nao um limite de negocio - a cadencia de captura fica
// do lado do app, OS-MOBILE-20) - so recusa um lote absurdamente grande de
// uma vez, indicio de bug no app (ex: loop de captura sem debounce), nao
// um cenario de uso legitimo mesmo em dias offline longos.
//
// OS-BACKEND-37: 2000 rejeitava cenario legitimo (captura a cada 15s por
// varios dias offline ja passa de 2000 pontos - ex: 7 dias = ~40mil a
// 1/min, ou so ~672 a 15/min). Elevado com folga generosa; ainda recusa um
// runaway de verdade (loop sem debounce produziria ordens de grandeza a
// mais que qualquer captura legitima, mesmo apos semanas offline).
export const TAMANHO_MAXIMO_LOTE = 50_000;

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

  // Precisao do GPS em metros no momento da captura (Position.accuracy,
  // Epico 4 - "Precisão mínima do GPS"). Opcional pra compatibilidade com
  // clientes antigos que ainda nao mandam esse campo - ponto sem precisao
  // informada passa direto (nunca descartado so por faltar o campo, ver
  // RastreioService.registrarLote).
  @IsOptional()
  @IsNumber()
  @Min(0)
  precisao?: number;
}

export class EnviarLoteRastreioDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(TAMANHO_MAXIMO_LOTE)
  @ValidateNested({ each: true })
  @Type(() => PontoRastreioDto)
  pontos!: PontoRastreioDto[];
}
