import { Matches } from 'class-validator';

export class ConsultarTrajetoDataQueryDto {
  // YYYY-MM-DD - um dia (00:00 a 23:59:59.999), nao um range. Mesmo
  // criterio de ConsultarTrajetoQueryDto (admin-rastreio.controller.ts) -
  // vendedorId aqui vem do path, nao da querystring.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'data deve estar no formato YYYY-MM-DD' })
  data!: string;
}
