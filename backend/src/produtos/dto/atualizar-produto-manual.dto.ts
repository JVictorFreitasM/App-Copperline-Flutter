import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

// Campos que NAO vem do WK Radar (ver schema.prisma) - editaveis
// manualmente via PATCH /admin/produtos/:id.
export class AtualizarProdutoManualDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precoFabricacao?: number;

  // Referencia a TipoAcondicionamento (OS-novas-implementacoes.md Bloco
  // 4) - validado contra o catalogo real (existe/esta ativo) dentro do
  // service, nao aqui (DTO so valida forma, nao existencia no banco).
  // string | null (nao so' opcional) - null explicito e' como o front
  // limpa a associacao (ver ProdutoManualService.atualizar, so' valida
  // contra o catalogo quando o valor e' truthy).
  @ValidateIf((_, valor) => valor !== null)
  @IsOptional()
  @IsString()
  tipoAcondicionamentoId?: string | null;
}
