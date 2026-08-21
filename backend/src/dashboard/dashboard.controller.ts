import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import type { ResumoDashboardDto } from './dto/resumo-dashboard.dto';

// Protegido por requireAuth via MiddlewareConsumer (ver dashboard.module.ts,
// mesmo padrao das demais).
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('resumo')
  obterResumo(): Promise<ResumoDashboardDto> {
    return this.dashboardService.obterResumo();
  }
}
