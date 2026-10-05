import { IsBoolean, IsEnum, IsInt, IsString, Matches, Max, Min, ValidateIf } from 'class-validator';
import { EnviarMensagemDto } from './enviar-mensagem.dto';

export const FREQUENCIAS_MENSAGEM = ['DIARIA', 'DIAS_UTEIS', 'SEMANAL', 'MENSAL'] as const;

// Mesmos campos do envio avulso (destino/assunto/mensagem) + a recorrencia.
// A coerencia entre frequencia e diaSemana/diaMes e' validada de novo no
// dominio (validarRecorrencia) - aqui so o formato.
export class SalvarMensagemPeriodicaDto extends EnviarMensagemDto {
  @IsEnum(FREQUENCIAS_MENSAGEM)
  frequencia!: (typeof FREQUENCIAS_MENSAGEM)[number];

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'horario deve estar no formato HH:mm' })
  horario!: string;

  @ValidateIf((dto: SalvarMensagemPeriodicaDto) => dto.frequencia === 'SEMANAL')
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana?: number;

  @ValidateIf((dto: SalvarMensagemPeriodicaDto) => dto.frequencia === 'MENSAL')
  @IsInt()
  @Min(1)
  @Max(31)
  diaMes?: number;
}

export class AlternarMensagemPeriodicaDto {
  @IsBoolean()
  ativa!: boolean;
}
