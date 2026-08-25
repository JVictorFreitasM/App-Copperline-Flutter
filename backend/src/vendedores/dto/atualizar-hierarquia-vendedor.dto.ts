import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

const PAPEIS = ['VENDEDOR', 'SUPERVISOR', 'GERENTE'] as const;

export class AtualizarHierarquiaVendedorDto {
  @IsOptional()
  @IsIn(PAPEIS)
  papel?: (typeof PAPEIS)[number];

  // Aceita null explicito (remove o supervisor) ou uma string (novo
  // supervisorId) - so valida como string quando nao for null/undefined.
  @ValidateIf((dto) => dto.supervisorId !== null)
  @IsOptional()
  @IsString()
  supervisorId?: string | null;
}
