import { IsDateString, IsUUID } from 'class-validator';

export class CriarCoberturaDto {
  @IsUUID()
  vendedorOriginalId!: string;

  @IsUUID()
  vendedorSubstitutoId!: string;

  @IsDateString()
  dataInicio!: string;

  @IsDateString()
  dataFim!: string;
}
