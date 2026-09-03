import { Matches } from 'class-validator';

const REGEX_MES_ANO = /^\d{4}-(0[1-9]|1[0-2])$/;

export class MesAnoQueryDto {
  @Matches(REGEX_MES_ANO, { message: 'mesAno deve estar no formato YYYY-MM' })
  mesAno!: string;
}
