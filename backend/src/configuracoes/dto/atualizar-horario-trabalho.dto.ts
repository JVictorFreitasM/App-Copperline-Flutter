import { Matches } from 'class-validator';

const REGEX_HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

// PATCH /vendedores/me/horario-trabalho (Epico 4, config-aba-rastreio.jpg
// - "Desabilitar edição de horário de trabalho no Android"). Sem
// IsOptional: os 2 campos sempre juntos - nao faz sentido customizar so
// o inicio ou so o fim, mesmo raciocinio de "faixa completa" do resto do
// projeto.
export class AtualizarHorarioTrabalhoDto {
  @Matches(REGEX_HORARIO, { message: 'horarioInicioTrabalho deve estar no formato HH:mm' })
  horarioInicioTrabalho!: string;

  @Matches(REGEX_HORARIO, { message: 'horarioFimTrabalho deve estar no formato HH:mm' })
  horarioFimTrabalho!: string;
}
