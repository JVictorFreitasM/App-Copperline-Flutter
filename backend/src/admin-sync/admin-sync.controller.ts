import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import type { ConfiguracaoSyncDto } from '../sync/sync-config.service';
import { SyncConfigService } from '../sync/sync-config.service';
import { AtualizarConfiguracaoSyncDto } from './dto/atualizar-configuracao-sync.dto';

// Endpoint administrativo generico (OS-BACKEND-15) - protegido so por
// ApiKeyGuard (nao por sessao SSO, mesmo criterio de
// backend/src/common/guards/api-key.guard.ts), sem UI ainda (fora de
// escopo, ver OS-WEB-18).
@Controller('admin/sync')
@UseGuards(ApiKeyGuard)
export class AdminSyncController {
  constructor(private readonly syncConfigService: SyncConfigService) {}

  @Get('configuracoes')
  listar(): Promise<ConfiguracaoSyncDto[]> {
    return this.syncConfigService.listar();
  }

  @Patch('configuracoes/:nomeEntidade')
  atualizar(
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
}
