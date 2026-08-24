import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import type { PaginatedResult } from '../common/pagination';
import type { ConfiguracaoSyncDto } from '../sync/sync-config.service';
import { SyncConfigService } from '../sync/sync-config.service';
import type {
  RegistrosIncompletosDto,
  SyncLogResumoDto,
} from '../sync/sync-observability.service';
import { SyncObservabilityService } from '../sync/sync-observability.service';
import { AtualizarConfiguracaoSyncDto } from './dto/atualizar-configuracao-sync.dto';

// Endpoint administrativo generico (OS-BACKEND-15/16) - protegido so por
// ApiKeyGuard (nao por sessao SSO, mesmo criterio de
// backend/src/common/guards/api-key.guard.ts), sem UI ainda (fora de
// escopo, ver OS-WEB-18).
@Controller('admin/sync')
@UseGuards(ApiKeyGuard)
export class AdminSyncController {
  constructor(
    private readonly syncConfigService: SyncConfigService,
    private readonly syncObservabilityService: SyncObservabilityService,
  ) {}

  @Get('configuracoes')
  listarConfiguracoes(): Promise<ConfiguracaoSyncDto[]> {
    return this.syncConfigService.listar();
  }

  @Patch('configuracoes/:nomeEntidade')
  atualizarConfiguracao(
    @Param('nomeEntidade') nomeEntidade: string,
    @Body() dto: AtualizarConfiguracaoSyncDto,
  ): Promise<ConfiguracaoSyncDto> {
    return this.syncConfigService.atualizar(nomeEntidade, dto);
  }

  @Post(':nomeEntidade/executar-agora')
  @HttpCode(202)
  async executarAgora(@Param('nomeEntidade') nomeEntidade: string): Promise<void> {
    await this.syncConfigService.executarAgora(nomeEntidade);
  }

  @Get('registros-incompletos')
  listarRegistrosIncompletos(): Promise<RegistrosIncompletosDto> {
    return this.syncObservabilityService.listarRegistrosIncompletos();
  }

  @Get(':nomeEntidade/logs')
  listarLogs(
    @Param('nomeEntidade') nomeEntidade: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<SyncLogResumoDto>> {
    return this.syncObservabilityService.listarLogs(nomeEntidade, query.page, query.limit);
  }
}
