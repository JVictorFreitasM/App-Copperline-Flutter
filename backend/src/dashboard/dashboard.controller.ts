import { Controller, Get, Query } from '@nestjs/common';
import { ComparativoVendedoresService } from './comparativo-vendedores.service';
import { DashboardService } from './dashboard.service';
import { ComparativoVendedoresQueryDto } from './dto/comparativo-vendedores.dto';
import type { ComparativoVendedorDto } from './dto/comparativo-vendedores.dto';
import { EstoqueCriticoQueryDto } from './dto/estoque-critico-dashboard.dto';
import type { EstoqueCriticoDashboardDto } from './dto/estoque-critico-dashboard.dto';
import type { FunilPedidosDashboardDto } from './dto/funil-pedidos-dashboard.dto';
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
  ) {}

  @Get('resumo')
  obterResumo(): Promise<ResumoDashboardDto> {
    return this.dashboardService.obterResumo();
  }

  @Get('vendas')
  obterVendas(@Query() query: PeriodoQueryDto): Promise<VendasDashboardDto> {
    return this.dashboardService.obterVendas(query);
  }

  @Get('ranking')
  obterRanking(@Query() query: RankingQueryDto): Promise<RankingDashboardDto> {
    return this.dashboardService.obterRanking(query);
  }

  @Get('notas-fiscais')
  obterNotasFiscais(@Query() query: PeriodoQueryDto): Promise<NotasFiscaisDashboardDto> {
    return this.dashboardService.obterNotasFiscais(query);
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
  obterFunilPedidos(@Query() query: PeriodoQueryDto): Promise<FunilPedidosDashboardDto> {
    return this.dashboardService.obterFunilPedidos(query);
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
}
