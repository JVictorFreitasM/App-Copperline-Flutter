import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { ClienteTabelaPrecoService } from './cliente-tabela-preco.service';
import { AssociarTabelaPrecoDto } from './dto/associar-tabela-preco.dto';

// Protegido por requireAuth + requireRole('admin') via MiddlewareConsumer
// (ver tabelas-preco.module.ts) - associar/desassociar tabela de preco a
// um cliente e' acao administrativa de catalogo, mesmo criterio de
// AdminTabelasPrecoController. OS-novas-implementacoes.md Bloco 1.
@Controller('admin/clientes/:clienteId/tabelas-preco')
export class AdminClientesTabelasPrecoController {
  constructor(private readonly clienteTabelaPrecoService: ClienteTabelaPrecoService) {}

  @Post()
  @HttpCode(204)
  associar(
    @Param('clienteId') clienteId: string,
    @Body() dto: AssociarTabelaPrecoDto,
  ): Promise<void> {
    return this.clienteTabelaPrecoService.associar(clienteId, dto.codigo);
  }

  @Delete(':codigo')
  @HttpCode(204)
  desassociar(
    @Param('clienteId') clienteId: string,
    @Param('codigo') codigo: string,
  ): Promise<void> {
    return this.clienteTabelaPrecoService.desassociar(clienteId, codigo);
  }
}
