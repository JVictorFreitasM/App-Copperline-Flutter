import { IsNotEmpty, IsString } from 'class-validator';

export class AssociarTabelaPrecoDto {
  @IsString()
  @IsNotEmpty()
  codigo!: string;
}
