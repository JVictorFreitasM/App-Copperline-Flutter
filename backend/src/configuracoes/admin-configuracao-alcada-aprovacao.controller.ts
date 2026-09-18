import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ConfiguracaoDescontoService } from '../solicitacoes-desconto/configuracao-desconto.service';
import type { ConfiguracaoDescontoDto } from '../solicitacoes-desconto/configuracao-desconto.service';
import { AtualizarAlcadaAprovacaoDto } from '../solicitacoes-desconto/dto/atualizar-alcada-aprovacao.dto';

// Protegido por requireAuth + requireRole('admin') via MiddlewareConsumer
// (ver configuracoes.module.ts) - aba "Alcada de Aprovacao" da tela de
// Configuracoes (Epico 4). Reaproveita ConfiguracaoDescontoService/tabela
// configuracao_desconto (mesma regra de negocio, so exposta aqui com auth
// de sessao web em vez de ApiKeyGuard) - ver admin-configuracao-desconto.
// controller.ts (endpoint ops original, inalterado) e o comentario no
// schema.prisma (model ConfiguracaoDesconto) sobre o que ainda nao esta
// conectado a logica de aprovacao.
@Controller('admin/configuracoes/alcada-aprovacao')
export class AdminConfiguracaoAlcadaAprovacaoController {
  constructor(private readonly configuracaoDescontoService: ConfiguracaoDescontoService) {}

  @Get()
  obter(): Promise<ConfiguracaoDescontoDto> {
    return this.configuracaoDescontoService.obter();
  }

  @Patch()
  atualizar(@Body() dto: AtualizarAlcadaAprovacaoDto): Promise<ConfiguracaoDescontoDto> {
    return this.configuracaoDescontoService.atualizar(dto);
  }
}
