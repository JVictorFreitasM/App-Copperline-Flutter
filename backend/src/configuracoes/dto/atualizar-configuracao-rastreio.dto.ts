import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Matches, Min } from 'class-validator';

// "HH:mm", 00-23:00-59 - mesmo formato mostrado nos campos "Horario de
// inicio/termino do rastreamento por GPS" da imagem de referencia
// (config-aba-rastreio.jpg).
const REGEX_HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

export class AtualizarConfiguracaoRastreioDto {
  @IsBoolean()
  desabilitarEdicaoHorarioTrabalhoAndroid!: boolean;

  @IsBoolean()
  habilitarRastreamentoSabados!: boolean;

  @IsBoolean()
  habilitarRastreamentoDomingos!: boolean;

  @Matches(REGEX_HORARIO, { message: 'horarioInicioRastreamento deve estar no formato HH:mm' })
  horarioInicioRastreamento!: string;

  @Matches(REGEX_HORARIO, { message: 'horarioTerminoRastreamento deve estar no formato HH:mm' })
  horarioTerminoRastreamento!: string;

  @IsInt()
  @Min(1)
  precisaoMinimaMetrosGps!: number;

  @IsInt()
  @Min(0)
  tempoMinimoAcordarGpsMs!: number;

  @IsBoolean()
  permitirRegistroComGpsDesabilitado!: boolean;

  // Campo vazio na imagem de referencia - nullable (sem exigencia
  // configurada), mas quando informado segue o mesmo minimo de 50m citado
  // no texto de ambos os campos de distancia.
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsInt()
  @Min(50)
  distanciaMaximaClienteRegistroPedidoMetros!: number | null;

  @IsInt()
  @Min(50)
  distanciaMaximaClienteRegistroVisitaMetros!: number;
}
