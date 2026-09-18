import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CheckoutVisitaDto {
  // Opcional (Epico 4, config-aba-rastreio.jpg -
  // "permitirRegistroComGpsDesabilitado") - mesmo criterio de
  // CheckinVisitaDto.
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsString()
  nota?: string;
}
