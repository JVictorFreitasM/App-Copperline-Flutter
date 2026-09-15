import { IsBoolean } from 'class-validator';

export class AtualizarPermiteCheckinSemAgendamentoDto {
  @IsBoolean()
  permiteCheckinSemAgendamento!: boolean;
}
