import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

// multipart/form-data (a foto viaja junto, ver VisitasController.checkin)
// - campos de texto chegam como string, @Type(() => Number) converte
// antes da validacao (mesmo padrao ja usado em RupturaPrevistaQueryDto).
export class CheckinVisitaDto {
  @IsUUID()
  clienteId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsString()
  nota?: string;
}
