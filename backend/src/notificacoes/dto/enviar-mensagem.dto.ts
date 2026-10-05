import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

const aparar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const DESTINOS_MENSAGEM = ['TODOS', 'VENDEDOR', 'GRUPO'] as const;
export type DestinoMensagemInput = (typeof DESTINOS_MENSAGEM)[number];

export class EnviarMensagemDto {
  @IsEnum(DESTINOS_MENSAGEM)
  destino!: DestinoMensagemInput;

  @ValidateIf((dto: EnviarMensagemDto) => dto.destino === 'VENDEDOR')
  @IsString()
  @IsNotEmpty()
  vendedorId?: string;

  @ValidateIf((dto: EnviarMensagemDto) => dto.destino === 'GRUPO')
  @IsString()
  @IsNotEmpty()
  grupoId?: string;

  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  assunto!: string;

  // Limite pensado pro push (FCM aceita ~4KB de payload e o corpo e' truncado
  // na bandeja do SO de qualquer forma); o texto inteiro fica no inbox.
  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  mensagem!: string;
}
