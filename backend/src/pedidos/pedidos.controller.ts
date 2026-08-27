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
import { RelatorioPedidosQueryDto } from './dto/relatorio-pedidos-query.dto';
import type { RelatorioPedidosDto } from './dto/relatorio-pedidos-response.dto';
import { RelatorioPedidosService } from './relatorio-pedidos.service';

// Protegido por requireAuth via MiddlewareConsumer (ver pedidos.module.ts).
@Controller('pedidos')
export class PedidosController {
  constructor(
    private readonly pedidosService: PedidosService,
    private readonly criarPedidoService: CriarPedidoService,
    private readonly usuariosService: UsuariosService,
    private readonly vendedorEscopoService: VendedorEscopoService,
    private readonly relatorioPedidosService: RelatorioPedidosService,
  ) {}

  @Get()
  listar(
    @Query() query: ListarPedidosQueryDto,
  ): Promise<PaginatedResult<PedidoResumoDto>> {
    return this.pedidosService.listar(query);
  }

  // "/relatorio" ANTES de "/:id" - mesmo motivo de 'favoritos' em
  // produtos.controller.ts (OS-BACKEND-19): "/:id" (GET) casaria com
  // "relatorio" como valor de id se viesse antes. Painel de gestão
  // (OS-WEB-27) - escopado por hierarquia dentro de
  // RelatorioPedidosService.obter (VendedorEscopoService), não aqui.
  @Get('relatorio')
  async relatorio(
    @Query() query: RelatorioPedidosQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<RelatorioPedidosDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.relatorioPedidosService.obter(idpUser, usuario.id, query);
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
