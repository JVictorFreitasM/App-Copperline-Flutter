import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// 'com_pedido'/'sem_visita' (ajustes-layout-mobile, item 6 - chips de
// filtro na listagem de clientes do mobile) - omitido (undefined) e' o
// "Todos" sem filtro extra nenhum.
export type FiltroClientes = 'com_pedido' | 'sem_visita';

export class ListarClientesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  cpfCnpj?: string;

  @IsOptional()
  @IsIn(['com_pedido', 'sem_visita'])
  filtro?: FiltroClientes;
}
