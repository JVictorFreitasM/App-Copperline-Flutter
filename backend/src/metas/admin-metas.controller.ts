import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { AtualizarConfiguracaoGamificacaoDto } from './dto/configuracao-gamificacao.dto';
import { DefinirMetaVendedorDto } from './dto/definir-meta-vendedor.dto';
import type { ConfiguracaoGamificacaoDto } from './configuracao-gamificacao.service';
import { ConfiguracaoGamificacaoService } from './configuracao-gamificacao.service';
import type { MetaVendedorDto } from './meta-vendedor.service';
import { MetaVendedorService } from './meta-vendedor.service';

// Endpoints administrativos (OS-BACKEND-44) - protegidos so por
// ApiKeyGuard, mesmo criterio de admin/vendedores/:id/hierarquia (meta nao
// vem do WK Radar, e' configuracao manual de gestao).
@Controller('admin/vendedores')
@UseGuards(ApiKeyGuard)
export class AdminMetasController {
  constructor(private readonly metaVendedorService: MetaVendedorService) {}

  @Patch(':id/meta')
  definirMeta(
    @Param('id') id: string,
    @Body() dto: DefinirMetaVendedorDto,
  ): Promise<MetaVendedorDto> {
    return this.metaVendedorService.definir(id, dto);
  }
}

@Controller('admin/gamificacao')
@UseGuards(ApiKeyGuard)
export class AdminGamificacaoController {
  constructor(
    private readonly configuracaoGamificacaoService: ConfiguracaoGamificacaoService,
  ) {}

  @Get('configuracao')
  obter(): Promise<ConfiguracaoGamificacaoDto> {
    return this.configuracaoGamificacaoService.obter();
  }

  @Patch('configuracao')
  atualizar(
    @Body() dto: AtualizarConfiguracaoGamificacaoDto,
  ): Promise<ConfiguracaoGamificacaoDto> {
    return this.configuracaoGamificacaoService.atualizar(
      dto.rankingVisivelParaVendedor,
    );
  }
}
