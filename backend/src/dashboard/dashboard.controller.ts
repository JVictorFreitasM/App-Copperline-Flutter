import { Controller, Get, Query } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import {
  restringirEscopoPorVendedorId,
  VendedorEscopoService,
} from '../vendedores/vendedor-escopo.service';
import { ComparativoVendedoresService } from './comparativo-vendedores.service';
import { DashboardService } from './dashboard.service';
import { ComparativoMensalQueryDto } from './dto/comparativo-mensal-dashboard.dto';
import type { ComparativoMensalDashboardDto } from './dto/comparativo-mensal-dashboard.dto';
import { ComparativoVendedoresQueryDto } from './dto/comparativo-vendedores.dto';
import type { ComparativoVendedorDto } from './dto/comparativo-vendedores.dto';
import type { VendasPorEstadoDashboardDto } from './dto/vendas-por-estado-dashboard.dto';
import type { VendasVsFaturadoDashboardDto } from './dto/vendas-vs-faturado-dashboard.dto';
import { EstoqueCriticoQueryDto } from './dto/estoque-critico-dashboard.dto';
import type { EstoqueCriticoDashboardDto } from './dto/estoque-critico-dashboard.dto';
import type { FunilPedidosDashboardDto } from './dto/funil-pedidos-dashboard.dto';
import type { KpisDashboardDto } from './dto/kpis-dashboard.dto';
import type { MapaCalorVendasDto } from './dto/mapa-calor-vendas.dto';
import { filtroPeriodo } from './filtro-periodo';
import type { NotasFiscaisDashboardDto } from './dto/notas-fiscais-dashboard.dto';
import { PeriodoQueryDto } from './dto/periodo-query.dto';
import { RankingQueryDto } from './dto/ranking-dashboard.dto';
import type { RankingDashboardDto } from './dto/ranking-dashboard.dto';
import type { ResumoDashboardDto } from './dto/resumo-dashboard.dto';
import { SazonalidadeQueryDto } from './dto/sazonalidade-query.dto';
import type { VendasDashboardDto } from './dto/vendas-dashboard.dto';
import type { SazonalidadeDto } from './sazonalidade.service';
import { SazonalidadeService } from './sazonalidade.service';

// Protegido por requireAuth via MiddlewareConsumer (ver dashboard.module.ts,
// mesmo padrao das demais). Endpoints de KPI (OS-BACKEND-17) - suporte pro
// painel de gestao (OS-WEB-19, sem UI aqui).
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly sazonalidadeService: SazonalidadeService,
    private readonly comparativoVendedoresService: ComparativoVendedoresService,
    private readonly usuariosService: UsuariosService,
    private readonly vendedorEscopoService: VendedorEscopoService,
  ) {}

  @Get('resumo')
  obterResumo(): Promise<ResumoDashboardDto> {
    return this.dashboardService.obterResumo();
  }

  // OS-dashboard-configuracoes-notificacoes-auditoria.md, Epico 1.1 - 3
  // cards de KPI do topo do painel (Orcamentos Abertos, +30 dias sem
  // pedido, Ticket Medio de Vendas).
  @Get('kpis')
  obterKpis(): Promise<KpisDashboardDto> {
    return this.dashboardService.obterKpis();
  }

  @Get('vendas')
  async obterVendas(
    @Query() query: PeriodoQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<VendasDashboardDto> {
    const escopo = await this.resolverEscopo(idpUser, query.vendedorId);
    return this.dashboardService.obterVendas(query, escopo);
  }

  @Get('ranking')
  async obterRanking(
    @Query() query: RankingQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<RankingDashboardDto> {
    const escopo = await this.resolverEscopo(idpUser, query.vendedorId);
    return this.dashboardService.obterRanking(query, escopo);
  }

  @Get('notas-fiscais')
  async obterNotasFiscais(
    @Query() query: PeriodoQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<NotasFiscaisDashboardDto> {
    const escopo = await this.resolverEscopo(idpUser, query.vendedorId);
    return this.dashboardService.obterNotasFiscais(query, escopo);
  }

  @Get('estoque-critico')
  obterEstoqueCritico(
    @Query() query: EstoqueCriticoQueryDto,
  ): Promise<EstoqueCriticoDashboardDto> {
    return this.dashboardService.obterEstoqueCritico(query);
  }

  // OS-WEB-41 - etapas do funil de pedidos, ver domain/montar-funil-pedidos.ts
  // pro porque das etapas usadas (nao "aguardando aprovacao"/"aprovado" do
  // texto original da OS - StatusPedidoLocal ainda nao tem dado real,
  // OS-BACKEND-25 bloqueada).
  @Get('funil-pedidos')
  async obterFunilPedidos(
    @Query() query: PeriodoQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<FunilPedidosDashboardDto> {
    const escopo = await this.resolverEscopo(idpUser, query.vendedorId);
    return this.dashboardService.obterFunilPedidos(query, escopo);
  }

  // OS-WEB-39 - so' clientes com pin de localizacao definido (ver
  // dto/mapa-calor-vendas.dto.ts pro porque de nao cobrir todos).
  @Get('mapa-calor-vendas')
  obterMapaCalorVendas(@Query() query: PeriodoQueryDto): Promise<MapaCalorVendasDto> {
    return this.dashboardService.obterMapaCalorVendas(query);
  }

  // OS-BACKEND-49 - serie mensal (13 meses) + variacao vs mesmo mes do ano
  // anterior, calculadas deterministicamente (ver sazonalidade.service.ts);
  // insight textual via IA e' so' interpretacao desses numeros ja prontos.
  @Get('sazonalidade')
  obterSazonalidade(@Query() query: SazonalidadeQueryDto): Promise<SazonalidadeDto> {
    return this.sazonalidadeService.obter(query.produtoId);
  }

  // OS-WEB-40 - radar comparando 2-4 vendedores (validacao de tamanho da
  // lista via @ArrayMinSize/@ArrayMaxSize no proprio DTO).
  @Get('comparativo-vendedores')
  obterComparativoVendedores(
    @Query() query: ComparativoVendedoresQueryDto,
  ): Promise<ComparativoVendedorDto[]> {
    return this.comparativoVendedoresService.obter(
      query.vendedorIds,
      filtroPeriodo(query.dataInicial, query.dataFinal) ?? {},
    );
  }

  // OS-dashboard-configuracoes-notificacoes-auditoria.md, Epico 2 -
  // comparativo mes a mes, ano atual vs ano anterior.
  @Get('comparativo-mensal')
  async obterComparativoMensal(
    @Query() query: ComparativoMensalQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<ComparativoMensalDashboardDto> {
    const escopo = await this.resolverEscopo(idpUser, query.vendedorId);
    return this.dashboardService.obterComparativoMensal(query, escopo);
  }

  // OS-dashboard-configuracoes-notificacoes-auditoria.md, Epico 1.2.
  @Get('vendas-por-estado')
  async obterVendasPorEstado(
    @Query() query: PeriodoQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<VendasPorEstadoDashboardDto> {
    const escopo = await this.resolverEscopo(idpUser, query.vendedorId);
    return this.dashboardService.obterVendasPorEstado(query, escopo);
  }

  // OS-dashboard-configuracoes-notificacoes-auditoria.md, Epico 1.2 -
  // "Vendas x Faturado".
  @Get('vendas-vs-faturado')
  async obterVendasVsFaturado(
    @Query() query: PeriodoQueryDto,
    @CurrentUser() idpUser: IdpUser,
  ): Promise<VendasVsFaturadoDashboardDto> {
    const escopo = await this.resolverEscopo(idpUser, query.vendedorId);
    return this.dashboardService.obterVendasVsFaturado(query, escopo);
  }

  // Epico 1.2 - resolve o escopo automatico (TODOS/EQUIPE/PROPRIO/NENHUM,
  // ja usado em pedidos/clientes) e, se um vendedorId especifico foi
  // escolhido no filtro "Equipe" do painel, restringe pra ele (validado
  // contra o escopo - ver restringirEscopoPorVendedorId).
  private async resolverEscopo(idpUser: IdpUser, vendedorId?: string) {
    const usuario = await this.usuariosService.obterOuCriarPorSub(idpUser);
    const escopo = await this.vendedorEscopoService.resolverEscopoVendedores(
      idpUser,
      usuario.id,
    );
    return restringirEscopoPorVendedorId(escopo, vendedorId);
  }
}
