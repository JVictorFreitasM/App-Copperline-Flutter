import { IsNumber, IsPositive, Matches } from 'class-validator';

// "YYYY-MM" - representa o MES inteiro (ver comentario do model
// MetaVendedor no schema.prisma), nunca um dia especifico dentro dele.
const REGEX_MES_ANO = /^\d{4}-(0[1-9]|1[0-2])$/;

export class DefinirMetaVendedorDto {
  @Matches(REGEX_MES_ANO, { message: 'mesAno deve estar no formato YYYY-MM' })
  mesAno!: string;

  @IsNumber()
  @IsPositive()
  valorMeta!: number;
}
