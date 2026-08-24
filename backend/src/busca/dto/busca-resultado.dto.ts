import type { ClienteResumoDto } from '../../clientes/dto/cliente-response.dto';
import type { PedidoResumoDto } from '../../pedidos/dto/pedido-response.dto';
import type { ProdutoResumoDto } from '../../produtos/dto/produto-response.dto';

export interface BuscaResultadoDto {
  clientes: ClienteResumoDto[];
  produtos: ProdutoResumoDto[];
  pedidos: PedidoResumoDto[];
}
