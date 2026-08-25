import { IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CheckinVisitaDto {
  @IsUUID()
  clienteId!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsString()
  nota?: string;
}
