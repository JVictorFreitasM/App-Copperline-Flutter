import { IsUUID, Matches } from 'class-validator';

export class ConsultarTrajetoQueryDto {
  @IsUUID()
  vendedorId!: string;

  // YYYY-MM-DD - um dia (00:00 a 23:59:59.999), nao um range. Regex
  // explicito (nao IsDateString) pra nao depender do comportamento de
  // "strict" da lib com horario embutido.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'data deve estar no formato YYYY-MM-DD' })
  data!: string;
}
