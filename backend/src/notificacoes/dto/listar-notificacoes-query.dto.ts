import { Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListarNotificacoesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  apenasNaoLidas?: boolean;
}
