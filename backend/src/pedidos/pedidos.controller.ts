import { Controller, Get, Param, Query } from '@nestjs/common';
import type { PaginatedResult } from '../common/pagination';
import { PedidosService } from './pedidos.service';
import type {
  PedidoDetalheDto,
  PedidoResumoDto,
} from './dto/pedido-response.dto';
import { ListarPedidosQueryDto } from './dto/listar-pedidos-query.dto';

// Protegido por requireAuth via MiddlewareConsumer (ver pedidos.module.ts).
@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Get()
  listar(
    @Query() query: ListarPedidosQueryDto,
  ): Promise<PaginatedResult<PedidoResumoDto>> {
    return this.pedidosService.listar(query);
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string): Promise<PedidoDetalheDto> {
    return this.pedidosService.buscarPorId(id);
  }
}
