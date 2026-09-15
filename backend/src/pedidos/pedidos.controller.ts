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
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';
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
  async listar(
    @Query() query: ListarPedidosQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<PaginatedResult<PedidoResumoDto>> {
    const escopo = await this.resolverEscopo(idpUser);
    return this.pedidosService.listar(query, escopo);
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

  // "/contadores" ANTES de "/:id" (mesmo motivo de "/relatorio" acima) -
  // atalhos rapidos da listagem web (layout de referencia: "Não
  // integrados (N)" / "Aguardando aprovação (N)").
  @Get('contadores')
  async contadores(
    @CurrentUser() idpUser: IdpUser,
  ): Promise<{ naoIntegrados: number; aguardandoAprovacao: number }> {
    const escopo = await this.resolverEscopo(idpUser);
    return this.pedidosService.contarPorStatusAprovacao(escopo);
  }

  @Get(':id')
  async buscarPorId(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<PedidoDetalheDto> {
    const escopo = await this.resolverEscopo(idpUser);
    return this.pedidosService.buscarPorId(id, escopo);
  }

  // OS-BACKEND-33 - "/:id/historico" e' mais especifico que "/:id" (3
  // segmentos vs 2), sem risco de colisao independente da ordem.
  @Get(':id/historico')
  async obterHistorico(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<PedidoHistoricoStatusDto[]> {
    const escopo = await this.resolverEscopo(idpUser);
    return this.pedidosService.obterHistorico(id, escopo);
  }

  // Revisao por item (tela de detalhe do pedido, layout de referencia
  // ref1.jpeg) - ver comentario do enum StatusAprovacaoItemPedido no
  // schema.prisma. Verbos explicitos (aprovar/rejeitar/aprovar-tudo/
  // rejeitar-tudo), mesmo padrao ja usado em SolicitacoesDescontoController
  // (sem flag booleana escondendo o que a rota faz).
  @Post(':id/itens/:itemId/aprovar')
  async aprovarItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<PedidoDetalheDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    const escopo = await this.resolverEscopo(idpUser);
    return this.pedidosService.aprovarItem(id, itemId, usuario.id, escopo);
  }

  @Post(':id/itens/:itemId/rejeitar')
  async rejeitarItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<PedidoDetalheDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    const escopo = await this.resolverEscopo(idpUser);
    return this.pedidosService.rejeitarItem(id, itemId, usuario.id, escopo);
  }

  @Post(':id/itens/aprovar-tudo')
  async aprovarTodosItens(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<PedidoDetalheDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    const escopo = await this.resolverEscopo(idpUser);
    return this.pedidosService.aprovarTodosItens(id, usuario.id, escopo);
  }

  @Post(':id/itens/rejeitar-tudo')
  async rejeitarTodosItens(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<PedidoDetalheDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    const escopo = await this.resolverEscopo(idpUser);
    return this.pedidosService.rejeitarTodosItens(id, usuario.id, escopo);
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
  //
  // Por que NAO ha' requireRole(...) explicito aqui (achado da revisao de
  // seguranca, OS-novas-implementacoes.md Bloco 2): a autorizacao de "pra
  // qual cliente" um pedido pode ser criado ja e' resolvida pelo escopo
  // (admin=TODOS, supervisor/gerente=EQUIPE, vendedor=PROPRIO -
  // resolverEscopoClientes), aplicado dentro de
  // CriarPedidoService.buscarClienteNoEscopo via
  // construirWhereClientePorEscopo. Um guard de role adicional aqui seria
  // redundante (e mais fraco: um guard so' checaria "e' vendedor?", nao
  // "e' vendedor DESSE cliente especifico") - ver skill security-review,
  // item 2. Cobertura dos 3 papeis em criar-pedido.service.spec.ts.
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

  // Achado critico da auditoria de seguranca: listar/buscarPorId/
  // obterHistorico nao filtravam por escopo, expondo pedido de qualquer
  // cliente a qualquer usuario autenticado. Mesmo escopo ja usado em
  // criar() acima (VendedorEscopoService/EscopoClientes) - reaproveitado
  // aqui em vez de requireRole('admin') no modulo porque o app mobile
  // (vendedor comum) chama GET /pedidos e GET /pedidos/:id diretamente
  // (pedidos_screen.dart/pedido_detalhe_screen.dart), nao so' via
  // /mobile/snapshot.
  private async resolverEscopo(idpUser: IdpUser): Promise<EscopoClientes> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.vendedorEscopoService.resolverEscopoClientes(idpUser, usuario.id);
  }
}
