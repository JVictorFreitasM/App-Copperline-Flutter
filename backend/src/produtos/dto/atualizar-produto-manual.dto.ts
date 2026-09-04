import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

// Campos que NAO vem do WK Radar (ver schema.prisma) - editaveis
// manualmente via PATCH /admin/produtos/:id.
export class AtualizarProdutoManualDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precoFabricacao?: number;
}
