import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { ConfiguracaoTabelaPrecoDto } from './configuracao-tabela-preco.service';
import { ConfiguracaoTabelaPrecoService } from './configuracao-tabela-preco.service';
import { SelecionarTabelaPrecoDto } from './dto/selecionar-tabela-preco.dto';

// Protegido por requireAuth + requireRole('admin') via MiddlewareConsumer
// (ver tabelas-preco.module.ts) - "trocar a tabela" (pedido do usuario) e'
// uma acao de configuracao de catalogo feita por um humano logado pelo
// painel web, mesmo criterio de AdminProdutosController (nao ApiKeyGuard,
// reservado pra automacao/config de CADENCIA de sync - ver
// admin-sync.controller.ts). Selecionar aqui NAO dispara sync sozinho -
// depois de escolher o codigo, o admin roda "Executar agora" na tela de
// Sincronizacao (/admin/sincronizacao, ja existente) pra buscar os dados;
// evita import circular entre TabelasPrecoModule e SyncModule so' pra
// esse acionamento automatico.
@Controller('admin/tabelas-preco')
export class AdminTabelasPrecoController {
  constructor(private readonly configuracaoTabelaPrecoService: ConfiguracaoTabelaPrecoService) {}

  @Get('configuracao')
  obterConfiguracao(): Promise<ConfiguracaoTabelaPrecoDto> {
    return this.configuracaoTabelaPrecoService.obter();
  }

  @Patch('configuracao')
  selecionar(@Body() dto: SelecionarTabelaPrecoDto): Promise<ConfiguracaoTabelaPrecoDto> {
    return this.configuracaoTabelaPrecoService.selecionar(dto.codigo);
  }
}
