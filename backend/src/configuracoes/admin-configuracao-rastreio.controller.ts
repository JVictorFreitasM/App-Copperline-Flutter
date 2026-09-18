import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ConfiguracaoRastreioService } from './configuracao-rastreio.service';
import type { ConfiguracaoRastreioDto } from './configuracao-rastreio.service';
import { AtualizarConfiguracaoRastreioDto } from './dto/atualizar-configuracao-rastreio.dto';

// Protegido por requireAuth + requireRole('admin') via MiddlewareConsumer
// (ver configuracoes.module.ts) - aba "Rastreio" da tela de Configuracoes
// (Epico 4), mesmo criterio de AdminTabelasPrecoController.
@Controller('admin/configuracoes/rastreio')
export class AdminConfiguracaoRastreioController {
  constructor(private readonly configuracaoRastreioService: ConfiguracaoRastreioService) {}

  @Get()
  obter(): Promise<ConfiguracaoRastreioDto> {
    return this.configuracaoRastreioService.obter();
  }

  @Patch()
  atualizar(
    @Body() dto: AtualizarConfiguracaoRastreioDto,
  ): Promise<ConfiguracaoRastreioDto> {
    return this.configuracaoRastreioService.atualizar(dto);
  }
}
