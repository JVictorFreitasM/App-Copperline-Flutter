import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Epico 2 da OS-dashboard-configuracoes-notificacoes-auditoria.md -
// comparativo mes a mes, ano atual vs ano anterior. `ano` opcional (default
// = ano corrente) deixa o vendedor navegar pra anos anteriores tambem, sem
// fixar "atual" no sentido literal de "hoje".
export class ComparativoMensalQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  ano?: number;

  // Filtro "Equipe" (Epico 1.2) - mesmo campo/validacao de
  // PeriodoQueryDto.vendedorId, duplicado aqui porque este DTO nao usa
  // dataInicial/dataFinal (nao estende PeriodoQueryDto).
  @IsOptional()
  @IsUUID()
  vendedorId?: string;
}

export interface ComparativoMensalMesDto {
  // 1-12 (Janeiro=1) - front resolve o rotulo (nome do mes), sem
  // depender de locale do backend.
  mes: number;
  valorAnoAtual: string;
  valorAnoAnterior: string;
}

export interface ComparativoMensalDashboardDto {
  anoAtual: number;
  anoAnterior: number;
  meses: ComparativoMensalMesDto[];
}
