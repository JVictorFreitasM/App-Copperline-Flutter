import { IsOptional, IsString } from 'class-validator';

export class ListarAgendamentosVisitaQueryDto {
  @IsOptional()
  @IsString()
  clienteId?: string;
}
