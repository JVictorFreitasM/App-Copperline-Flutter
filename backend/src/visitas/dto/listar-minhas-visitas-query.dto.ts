import { IsOptional, Matches } from 'class-validator';

export class ListarMinhasVisitasQueryDto {
  // YYYY-MM-DD - um dia (00:00 a 23:59:59.999), nao um range (mesmo
  // criterio de ConsultarTrajetoDataQueryDto, rastreio). Opcional - sem
  // filtro retorna todo o historico do vendedor (raro em uso real, o app
  // sempre manda a data do dia, ver OS-MOBILE-17).
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'data deve estar no formato YYYY-MM-DD' })
  data?: string;
}
