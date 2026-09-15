import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { TipoSituacaoPedido } from '../../../generated/prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const SITUACOES_VALIDAS = Object.values(TipoSituacaoPedido);

// Bucket derivado (nao e' um campo unico do banco) do fluxo local de
// criacao (CriarPedidoService) - ver PedidosService.listar pro where
// exato de cada valor. Rotulo na tela (layout de referencia,
// "Status de aprovacao"): NAO_INTEGRADO = "Orcamento"/"Nao integrados"
// (idExternoErp ainda null - pedido so existe aqui, nunca confirmado no
// Radar); AGUARDANDO_APROVACAO = statusLocal AGUARDANDO_APROVACAO
// (aguardando decisao de desconto antes de poder ser enviado); ENVIADO =
// tudo que ja tem confirmacao do Radar (idExternoErp preenchido) OU foi
// marcado ENVIADO localmente.
const STATUS_APROVACAO_VALIDOS = [
  'NAO_INTEGRADO',
  'AGUARDANDO_APROVACAO',
  'ENVIADO',
] as const;

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

  // "Status de entrega" no layout de referencia - mesmo campo Pedido.situacao
  // ja sincronizado do Radar, so renomeado na UI (ver frontend/lib/pedidos.ts).
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

  // "Equipe" no layout de referencia - filtra por um vendedor especifico
  // dentro do escopo do usuario logado (a checagem de que o vendedorId
  // pedido esta DENTRO do escopo acontece naturalmente no AND com
  // construirWherePedidoPorEscopo, ver PedidosService.listar - um
  // vendedorId fora do escopo simplesmente nao bate com nenhum pedido, sem
  // checagem especial).
  @IsOptional()
  @IsString()
  vendedorId?: string;

  @IsOptional()
  @IsIn(STATUS_APROVACAO_VALIDOS)
  statusAprovacao?: (typeof STATUS_APROVACAO_VALIDOS)[number];

  // "Localizacao" no layout de referencia - UF do endereco de entrega
  // (Pedido.ufEntrega, derivado do idMunicipio do Radar - ver
  // pedido.sync.ts). So ~7% dos pedidos tem esse dado (localEntrega raro
  // no Radar) - filtro deliberadamente estreito, documentado.
  @IsOptional()
  @IsString()
  ufEntrega?: string;
}
