import { IsString, MaxLength } from 'class-validator';

export class AtualizarComunicadoPedidoPdfDto {
  @IsString()
  @MaxLength(4000)
  texto!: string;
}
