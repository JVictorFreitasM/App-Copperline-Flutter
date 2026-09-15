import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CriarTipoAcondicionamentoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome!: string;

  // OS-novas-implementacoes.md Bloco 4 (revisao) - ausente = retalho
  // (corte fracionario livre); preenchido = tamanho fixo (multiplo ou
  // unidade, tamanhoPadrao=1 pro segundo caso - mesmo calculo, sem campo
  // de "modo" separado, ver domain/calculo-quantidade-pedido.ts).
  @IsOptional()
  @IsNumber()
  @IsPositive()
  tamanhoPadrao?: number;
}
