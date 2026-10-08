import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BloquearContaDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}
