import { IsString, MaxLength } from 'class-validator';

export class AtualizarDadosEmpresaPdfDto {
  @IsString()
  @MaxLength(200)
  razaoSocial!: string;

  @IsString()
  @MaxLength(30)
  cnpj!: string;

  @IsString()
  @MaxLength(300)
  endereco!: string;

  @IsString()
  @MaxLength(15)
  cep!: string;

  @IsString()
  @MaxLength(30)
  telefone!: string;
}
