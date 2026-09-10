import { IsNotEmpty, IsString } from 'class-validator';

export class SelecionarTabelaPrecoDto {
  @IsString()
  @IsNotEmpty()
  codigo!: string;
}
