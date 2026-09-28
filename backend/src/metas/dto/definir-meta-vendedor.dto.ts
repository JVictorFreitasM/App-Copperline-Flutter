import { IsEnum, IsNumber, IsPositive, Matches } from 'class-validator';
import type { TipoMeta, TipoPeriodicidadeMeta } from '../../../generated/prisma/client';

// Aceita "YYYY-MM" (mensal) OU "YYYY-Www" (semanal, semana ISO-8601) - qual
// dos dois e' valido depende de `periodicidade` (checado no service, nao
// aqui: class-validator nao valida um campo condicionado a outro de forma
// direta, ver MetaVendedorService.validarPeriodo).
const REGEX_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$|^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

export class DefinirMetaVendedorDto {
  @IsEnum(['MENSAL', 'SEMANAL'])
  periodicidade!: TipoPeriodicidadeMeta;

  @Matches(REGEX_PERIODO, {
    message: 'periodo deve estar no formato YYYY-MM (mensal) ou YYYY-Www (semanal)',
  })
  periodo!: string;

  @IsEnum(['DINHEIRO', 'PESO', 'MARGEM'])
  tipoMeta!: TipoMeta;

  @IsNumber()
  @IsPositive()
  valorMeta!: number;
}
