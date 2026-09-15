import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class CriarAgendamentoVisitaDto {
  @IsString()
  @IsNotEmpty()
  clienteId!: string;

  @IsDateString()
  dataHoraPrevista!: string;
}
