import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AtualizarWhatsappVendedorDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsapp?: string | null;
}
