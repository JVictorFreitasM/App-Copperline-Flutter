import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { StatusNfe, TipoNotaFiscal } from '../../../generated/prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const TIPOS_VALIDOS = Object.values(TipoNotaFiscal);
const STATUS_VALIDOS = Object.values(StatusNfe);

export class ListarNotasFiscaisQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  numero?: number;

  // Nota fiscal nao tem cliente proprio no nosso schema (so alcancavel via
  // pedidos[].cliente - ver nota-fiscal.sync.ts, sem alteracao nesta OS) -
  // filtro busca pelo nome do cliente de qualquer pedido vinculado.
  @IsOptional()
  @IsString()
  clienteNome?: string;

  @IsOptional()
  @IsIn(TIPOS_VALIDOS)
  tipo?: (typeof TIPOS_VALIDOS)[number];

  @IsOptional()
  @IsIn(STATUS_VALIDOS)
  statusNfe?: (typeof STATUS_VALIDOS)[number];
}
