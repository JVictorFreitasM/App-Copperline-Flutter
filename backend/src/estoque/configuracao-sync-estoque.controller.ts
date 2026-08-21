import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ConfiguracaoSyncEstoqueService } from './configuracao-sync-estoque.service';
import { AtualizarConfiguracaoSyncEstoqueDto } from './dto/configuracao-sync-estoque.dto';
import type { ConfiguracaoSyncEstoqueDto } from './dto/configuracao-sync-estoque.dto';

// Endpoint administrativo (nao acessado por usuario logado via SSO, ver
// ApiKeyGuard) - controller separado de EstoqueController de proposito:
// EstoqueModule.configure() aplica requireAuth (sessao SSO) a
// EstoqueController inteiro via .forRoutes(EstoqueController); este
// controller fica de fora dessa lista, protegido so pelo ApiKeyGuard.
@Controller('estoque/admin')
@UseGuards(ApiKeyGuard)
export class ConfiguracaoSyncEstoqueController {
  constructor(
    private readonly configuracaoSyncEstoqueService: ConfiguracaoSyncEstoqueService,
  ) {}

  @Get('configuracao-sincronizacao')
  obter(): Promise<ConfiguracaoSyncEstoqueDto> {
    return this.configuracaoSyncEstoqueService.obter();
  }

  @Patch('configuracao-sincronizacao')
  atualizar(
    @Body() dto: AtualizarConfiguracaoSyncEstoqueDto,
  ): Promise<ConfiguracaoSyncEstoqueDto> {
    return this.configuracaoSyncEstoqueService.atualizar(
      dto.intervaloSincronizacaoMinutos,
    );
  }
}
