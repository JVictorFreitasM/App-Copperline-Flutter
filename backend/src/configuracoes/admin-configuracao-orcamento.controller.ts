import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ConfiguracaoOrcamentoService } from './configuracao-orcamento.service';
import type { ConfiguracaoOrcamentoDto } from './configuracao-orcamento.service';
import { AtualizarConfiguracaoOrcamentoDto } from './dto/atualizar-configuracao-orcamento.dto';

// Protegido por requireAuth + requireRole('admin') via MiddlewareConsumer
// (ver configuracoes.module.ts) - aba "Orcamento" da tela de
// Configuracoes (Epico 4), mesmo criterio de AdminTabelasPrecoController.
@Controller('admin/configuracoes/orcamento')
export class AdminConfiguracaoOrcamentoController {
  constructor(private readonly configuracaoOrcamentoService: ConfiguracaoOrcamentoService) {}

  @Get()
  obter(): Promise<ConfiguracaoOrcamentoDto> {
    return this.configuracaoOrcamentoService.obter();
  }

  @Patch()
  atualizar(
    @Body() dto: AtualizarConfiguracaoOrcamentoDto,
  ): Promise<ConfiguracaoOrcamentoDto> {
    return this.configuracaoOrcamentoService.atualizar(dto);
  }
}
