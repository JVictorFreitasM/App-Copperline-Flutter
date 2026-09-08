import { Controller, HttpCode, HttpStatus, Param, Patch } from '@nestjs/common';
import type { TabelaPrecoResumoDto } from './dto/tabela-preco-response.dto';
import { TabelasPrecoService } from './tabelas-preco.service';

// Protegido por requireAuth + requireRole('admin') via MiddlewareConsumer
// (ver tabelas-preco.module.ts) - "trocar a tabela" (pedido do usuario) e'
// uma acao de configuracao de catalogo feita por um humano logado pelo
// painel web, mesmo criterio de AdminProdutosController (nao ApiKeyGuard,
// reservado pra automacao/config de CADENCIA de sync - ver
// admin-sync.controller.ts).
@Controller('admin/tabelas-preco')
export class AdminTabelasPrecoController {
  constructor(private readonly tabelasPrecoService: TabelasPrecoService) {}

  @Patch(':id/padrao')
  @HttpCode(HttpStatus.OK)
  definirPadrao(@Param('id') id: string): Promise<TabelaPrecoResumoDto> {
    return this.tabelasPrecoService.definirPadrao(id);
  }
}
