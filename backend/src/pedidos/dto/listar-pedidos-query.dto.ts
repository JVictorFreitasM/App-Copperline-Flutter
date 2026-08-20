import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { TipoSituacaoPedido } from '../../../generated/prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const SITUACOES_VALIDAS = Object.values(TipoSituacaoPedido);

export class ListarPedidosQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  clienteId?: string;

  // Busca por nome (razaoSocial/nomeFantasia) - diferente de clienteId
  // (id interno, so util quando ja se sabe o cliente de antemao, ex: link
  // "ver pedidos deste cliente" a partir da tela de detalhe do cliente).
  // Adicionado na OS-WEB-15 pra suportar o filtro de pedidos por cliente na
  // tela de listagem, onde o usuario digita um nome, nao um uuid.
  @IsOptional()
  @IsString()
  clienteNome?: string;

  @IsOptional()
  @IsIn(SITUACOES_VALIDAS)
  situacao?: (typeof SITUACOES_VALIDAS)[number];

  // Filtra por dataHoraUltimaAlteracao - unico campo de data que o pedido
  // sincronizado tem (nao ha "data de emissao" no modelo, ver nota da
  // OS-WEB-13). Datas no formato YYYY-MM-DD (input type="date" do front).
  @IsOptional()
  @IsDateString()
  dataInicial?: string;

  @IsOptional()
  @IsDateString()
  dataFinal?: string;
}
