import { IsOptional, IsString } from 'class-validator';

export class ListarAgendamentosEquipeQueryDto {
  @IsOptional()
  @IsString()
  vendedorId?: string;

  @IsOptional()
  @IsString()
  dataInicial?: string;

  @IsOptional()
  @IsString()
  dataFinal?: string;
}
