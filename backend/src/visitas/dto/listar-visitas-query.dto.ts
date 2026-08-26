import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// Mesmo padrao de ListarPedidosQueryDto (extends PaginationQueryDto, datas
// inline em vez de PeriodoQueryDto) - filtro por vendedor/cliente/periodo
// (OS-WEB-26). vendedorId aqui e' opcional: quando omitido, lista toda a
// equipe do escopo resolvido (ver VisitasService.listarEquipe); quando
// informado, precisa estar dentro do escopo (senao 404, anti-IDOR).
export class ListarVisitasQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  vendedorId?: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsDateString()
  dataInicial?: string;

  @IsOptional()
  @IsDateString()
  dataFinal?: string;
}
