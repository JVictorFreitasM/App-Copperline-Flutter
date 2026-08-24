import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { EstoqueCriticoQueryDto } from './dto/estoque-critico-dashboard.dto';
import type { EstoqueCriticoDashboardDto } from './dto/estoque-critico-dashboard.dto';
import type { NotasFiscaisDashboardDto } from './dto/notas-fiscais-dashboard.dto';
import { PeriodoQueryDto } from './dto/periodo-query.dto';
import { RankingQueryDto } from './dto/ranking-dashboard.dto';
import type { RankingDashboardDto } from './dto/ranking-dashboard.dto';
import type { ResumoDashboardDto } from './dto/resumo-dashboard.dto';
import type { VendasDashboardDto } from './dto/vendas-dashboard.dto';

// Protegido por requireAuth via MiddlewareConsumer (ver dashboard.module.ts,
// mesmo padrao das demais). Endpoints de KPI (OS-BACKEND-17) - suporte pro
// painel de gestao (OS-WEB-19, sem UI aqui).
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

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
}
