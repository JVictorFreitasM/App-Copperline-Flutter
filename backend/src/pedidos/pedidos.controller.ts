import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { PaginatedResult } from '../common/pagination';
import { UsuariosService } from '../usuarios/usuarios.service';
import { VendedorEscopoService } from '../vendedores/vendedor-escopo.service';
import { CriarPedidoService } from './criar-pedido.service';
import type { CriarPedidoResultadoDto } from './criar-pedido.service';
import { CriarPedidoDto } from './dto/criar-pedido.dto';
import { PedidosService } from './pedidos.service';
import type {
  PedidoDetalheDto,
  PedidoResumoDto,
} from './dto/pedido-response.dto';
import { ListarPedidosQueryDto } from './dto/listar-pedidos-query.dto';

// Protegido por requireAuth via MiddlewareConsumer (ver pedidos.module.ts).
@Controller('pedidos')
export class PedidosController {
  constructor(
    private readonly pedidosService: PedidosService,
    private readonly criarPedidoService: CriarPedidoService,
    private readonly usuariosService: UsuariosService,
    private readonly vendedorEscopoService: VendedorEscopoService,
  ) {}

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

  // OS-BACKEND-25 - reaproveita o mesmo escopo cliente<->vendedor de
  // GET /clientes (VendedorEscopoService, OS-BACKEND-23): so cria pedido
  // pra cliente dentro do escopo de quem esta autenticado.
  @Post()
  async criar(
    @Body() dto: CriarPedidoDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<CriarPedidoResultadoDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    const escopo = await this.vendedorEscopoService.resolverEscopoClientes(
      idpUser,
      usuario.id,
    );
    return this.criarPedidoService.criar(dto, usuario.id, escopo);
  }
}
