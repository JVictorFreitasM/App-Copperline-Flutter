import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ConfiguracaoLlmService } from './configuracao-llm.service';
import type { ConfiguracaoLlmDto } from './configuracao-llm.service';
import { AtualizarConfiguracaoLlmDto } from './dto/atualizar-configuracao-llm.dto';

// Endpoint administrativo (OS-BACKEND-20) - protegido so por ApiKeyGuard
// (mesmo criterio de backend/src/common/guards/api-key.guard.ts), nao por
// sessao SSO. GET nunca retorna a apiKey em si (ver ConfiguracaoLlmService).
@Controller('admin/llm')
@UseGuards(ApiKeyGuard)
export class AdminLlmController {
  constructor(private readonly configuracaoLlmService: ConfiguracaoLlmService) {}

  @Get('configuracao')
  obter(): Promise<ConfiguracaoLlmDto> {
    return this.configuracaoLlmService.obter();
  }

  @Patch('configuracao')
  atualizar(@Body() dto: AtualizarConfiguracaoLlmDto): Promise<ConfiguracaoLlmDto> {
    return this.configuracaoLlmService.atualizar(dto);
  }
}
