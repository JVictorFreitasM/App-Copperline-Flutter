import { IsBoolean } from 'class-validator';

export class AtualizarConfiguracaoFuncionalidadesDto {
  @IsBoolean()
  envioPedidosHabilitado!: boolean;

  @IsBoolean()
  cadastroClientesHabilitado!: boolean;
}
