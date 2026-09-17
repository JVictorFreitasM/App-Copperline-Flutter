import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Contato criado por nos (nunca sincronizado do WK Radar) - ver
// ContatoCliente.criadoLocalmente no schema.
export class CriarContatoClienteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  telefoneDdd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefoneNumero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  funcao?: string;
}
