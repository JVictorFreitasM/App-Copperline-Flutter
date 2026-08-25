import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ConfiguracaoDescontoService } from './configuracao-desconto.service';
import type { ConfiguracaoDescontoDto } from './configuracao-desconto.service';
import { AtualizarConfiguracaoDescontoDto } from './dto/atualizar-configuracao-desconto.dto';

// Endpoint administrativo (OS-BACKEND-22) - protegido so por ApiKeyGuard,
// mesmo criterio de admin/llm (OS-BACKEND-20) e admin/sync (OS-BACKEND-15).
@Controller('admin/configuracao-desconto')
@UseGuards(ApiKeyGuard)
export class AdminConfiguracaoDescontoController {
  constructor(
    private readonly configuracaoDescontoService: ConfiguracaoDescontoService,
  ) {}

  @Get()
  obter(): Promise<ConfiguracaoDescontoDto> {
    return this.configuracaoDescontoService.obter();
  }

  @Patch()
  atualizar(
    @Body() dto: AtualizarConfiguracaoDescontoDto,
  ): Promise<ConfiguracaoDescontoDto> {
    return this.configuracaoDescontoService.atualizar(dto);
  }
}
