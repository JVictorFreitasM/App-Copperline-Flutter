import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { PaginatedResult } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import type { SimularDescontoResultado } from '../solicitacoes-desconto/solicitacoes-desconto.service';
import { SolicitacoesDescontoService } from '../solicitacoes-desconto/solicitacoes-desconto.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { VendedorEscopoService } from '../vendedores/vendedor-escopo.service';
import { CriarPedidoService } from './criar-pedido.service';
import type { CriarPedidoResultadoDto } from './criar-pedido.service';
import { CriarPedidoDto } from './dto/criar-pedido.dto';
import { SimularDescontoDto } from './dto/simular-desconto.dto';
import { PedidosService } from './pedidos.service';
import type {
  PedidoDetalheDto,
  PedidoResumoDto,
} from './dto/pedido-response.dto';
import type { PedidoHistoricoStatusDto } from './dto/pedido-historico.dto';
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
    private readonly solicitacoesDescontoService: SolicitacoesDescontoService,
    private readonly prisma: PrismaService,
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

  // OS-BACKEND-33 - "/:id/historico" e' mais especifico que "/:id" (3
  // segmentos vs 2), sem risco de colisao independente da ordem.
  @Get(':id/historico')
  obterHistorico(@Param('id') id: string): Promise<PedidoHistoricoStatusDto[]> {
    return this.pedidosService.obterHistorico(id);
  }

  // OS-BACKEND-22-A - simulacao pura (nunca cria SolicitacaoDesconto nem
  // dispara notificacao, ver SolicitacoesDescontoService.simular()) - usada
  // em tempo real enquanto o vendedor monta o pedido, pra avisar antes de
  // confirmar se aquele desconto vai exigir aprovacao e de quem.
  @Post('simular-desconto')
  async simularDesconto(
    @Body() dto: SimularDescontoDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<SimularDescontoResultado> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    const vendedor = await this.prisma.vendedor.findFirst({
      where: { usuarioId: usuario.id },
    });
    if (!vendedor) {
      throw new ForbiddenException(
        'Usuário autenticado não é um vendedor cadastrado',
      );
    }
    return this.solicitacoesDescontoService.simular({
      vendedorSolicitanteId: vendedor.id,
      percentualSolicitado: dto.percentualDesconto,
    });
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
