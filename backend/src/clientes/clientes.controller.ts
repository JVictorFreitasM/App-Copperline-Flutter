import { Body, Controller, Get, Param, Patch, Query, StreamableFile } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';
import { VendedorEscopoService } from '../vendedores/vendedor-escopo.service';
import { ClienteBoletoService } from './cliente-boleto.service';
import { ClienteEstatisticasService } from './cliente-estatisticas.service';
import { ClienteTimelineService } from './cliente-timeline.service';
import type { TimelineEvento } from './cliente-timeline.service';
import type { ClienteEstatisticasDto } from './cliente-estatisticas.service';
import { ClienteFinanceiroService } from './cliente-financeiro.service';
import type { ClienteFinanceiroDto } from './cliente-financeiro.service';
import { ClienteLocalizacaoService } from './cliente-localizacao.service';
import type { ClienteLocalizacaoDto } from './cliente-localizacao.service';
import { ClienteResumoLlmService } from './cliente-resumo-llm.service';
import type { ClienteResumoLlmDto } from './cliente-resumo-llm.service';
import { ClientesService } from './clientes.service';
import type { ConflitoClienteDto } from './clientes.service';
import type {
  ClienteDetalheDto,
  ClienteResumoDto,
} from './dto/cliente-response.dto';
import { ClienteEstatisticasQueryDto } from './dto/cliente-estatisticas-query.dto';
import { DefinirLocalizacaoClienteDto } from './dto/definir-localizacao-cliente.dto';
import { ListarClientesQueryDto } from './dto/listar-clientes-query.dto';
import { VerificarConflitoQueryDto } from './dto/verificar-conflito-query.dto';
import type { PaginatedResult } from '../common/pagination';
import { VisitasService } from '../visitas/visitas.service';
import type { VisitaDto } from '../visitas/dto/visita-response.dto';

// Protegido por requireAuth via MiddlewareConsumer (ver clientes.module.ts,
// mesmo padrao da OS 03). GET /clientes e /:id sao escopados por vendedor
// (OS-BACKEND-23, ver VendedorEscopoService) - qualquer usuario autenticado
// acessa a ROTA, mas o CONTEUDO retornado depende de quem esta logado.
@Controller('clientes')
export class ClientesController {
  constructor(
    private readonly clientesService: ClientesService,
    private readonly clienteResumoLlmService: ClienteResumoLlmService,
    private readonly clienteEstatisticasService: ClienteEstatisticasService,
    private readonly clienteFinanceiroService: ClienteFinanceiroService,
    private readonly clienteBoletoService: ClienteBoletoService,
    private readonly clienteTimelineService: ClienteTimelineService,
    private readonly usuariosService: UsuariosService,
    private readonly vendedorEscopoService: VendedorEscopoService,
    private readonly visitasService: VisitasService,
    private readonly clienteLocalizacaoService: ClienteLocalizacaoService,
  ) {}

  @Get()
  async listar(
    @Query() query: ListarClientesQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<PaginatedResult<ClienteResumoDto>> {
    const escopo = await this.resolverEscopo(idpUser);
    return this.clientesService.listar(query, escopo);
  }

  // Literal, ANTES de `:id` - mesmo motivo de 'favoritos' em
  // produtos.controller.ts (OS-BACKEND-19): `:id` (GET) casaria com
  // "verificar-conflito" como valor de id se viesse antes. Unica rota de
  // cliente SEM escopo por vendedor de proposito (ver
  // ClientesService.verificarConflito).
  @Get('verificar-conflito')
  verificarConflito(
    @Query() query: VerificarConflitoQueryDto,
  ): Promise<ConflitoClienteDto> {
    return this.clientesService.verificarConflito(query.documento);
  }

  @Get(':id')
  async buscarPorId(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<ClienteDetalheDto> {
    const escopo = await this.resolverEscopo(idpUser);
    return this.clientesService.buscarPorId(id, escopo);
  }

  // OS-BACKEND-20 - "/:id/resumo" e' mais especifico que "/:id" (3
  // segmentos vs 2), sem risco de colisao independente da ordem de
  // declaracao (diferente do caso de /produtos/favoritos, ver
  // produtos.controller.ts).
  @Get(':id/resumo')
  async obterResumo(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<ClienteResumoLlmDto> {
    const escopo = await this.resolverEscopo(idpUser);
    return this.clienteResumoLlmService.obterResumo(id, escopo);
  }

  // OS-BACKEND-26 - "/:id/estatisticas" e' mais especifico que "/:id" (3
  // segmentos vs 2), mesmo raciocinio de "/:id/resumo" acima.
  @Get(':id/estatisticas')
  async obterEstatisticas(
    @Param('id') id: string,
    @Query() query: ClienteEstatisticasQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<ClienteEstatisticasDto> {
    const escopo = await this.resolverEscopo(idpUser);
    return this.clienteEstatisticasService.obter(id, query.meses, escopo);
  }

  // OS-BACKEND-36 - "/:id/financeiro" e' mais especifico que "/:id" (3
  // segmentos vs 2), mesmo raciocinio de "/:id/resumo"/"/:id/estatisticas".
  @Get(':id/financeiro')
  async obterFinanceiro(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<ClienteFinanceiroDto> {
    const escopo = await this.resolverEscopo(idpUser);
    return this.clienteFinanceiroService.obter(id, escopo);
  }

  // OS-BACKEND-43 - "/:id/titulos/:numeroDocumento/boleto" (nao
  // "/titulos/:id/boleto" solto, ver comentario em ClienteBoletoService)
  // pra reaproveitar o mesmo escopo por vendedor de todo endpoint de
  // cliente - obtem token via BuscarTokenBoleto e baixa o PDF via
  // DownloadBoleto (Financeiro.svc), sem persistir localmente.
  @Get(':id/titulos/:numeroDocumento/boleto')
  async obterBoleto(
    @Param('id') id: string,
    @Param('numeroDocumento') numeroDocumento: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<StreamableFile> {
    const escopo = await this.resolverEscopo(idpUser);
    const { buffer, nomeArquivo } = await this.clienteBoletoService.obter(
      id,
      escopo,
      numeroDocumento,
    );
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${encodeURIComponent(nomeArquivo)}"`,
    });
  }

  // OS-WEB-42/OS-MOBILE-40 - timeline combinada (pedido/status/visita/
  // nota fiscal), mesma especificidade de rota que /:id/financeiro etc.
  @Get(':id/timeline')
  async obterTimeline(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<TimelineEvento[]> {
    const escopo = await this.resolverEscopo(idpUser);
    return this.clienteTimelineService.obterTimeline(id, escopo);
  }

  // OS-BACKEND-28 - historico de visitas, pra exibir junto das
  // estatisticas (OS-BACKEND-26). Mesmo raciocinio de rota mais especifica
  // que "/:id" das rotas acima.
  @Get(':id/visitas')
  async listarVisitas(
    @Param('id') id: string,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<VisitaDto[]> {
    const escopo = await this.resolverEscopo(idpUser);
    return this.visitasService.listarPorCliente(id, escopo);
  }

  // "Pin" de localizacao do cliente (extensao pos-OS-BACKEND-28) - so o
  // vendedor vinculado ao cliente pode definir/redefinir (ver
  // ClienteLocalizacaoService, mesmo criterio de "cliente proprio" de
  // VisitasService.checkin).
  @Patch(':id/localizacao')
  async definirLocalizacao(
    @Param('id') id: string,
    @Body() dto: DefinirLocalizacaoClienteDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<ClienteLocalizacaoDto> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.clienteLocalizacaoService.definir(usuario.id, id, dto);
  }

  private async resolverEscopo(idpUser: IdpUser): Promise<EscopoClientes> {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    return this.vendedorEscopoService.resolverEscopoClientes(idpUser, usuario.id);
  }
}
