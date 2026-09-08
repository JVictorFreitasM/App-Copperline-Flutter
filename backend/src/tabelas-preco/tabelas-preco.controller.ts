import { Controller, Get, Param, Query } from '@nestjs/common';
import type { PaginatedResult } from '../common/pagination';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ListarTabelasPrecoQueryDto } from './dto/listar-tabelas-preco-query.dto';
import type { ItemTabelaPrecoDto, TabelaPrecoResumoDto } from './dto/tabela-preco-response.dto';
import { TabelasPrecoService } from './tabelas-preco.service';

// Protegido por requireAuth via MiddlewareConsumer (ver tabelas-preco.module.ts)
// - leitura aberta a qualquer vendedor autenticado, mesmo criterio de
// ProdutosController. Escrita (trocar tabela padrão) fica em
// AdminTabelasPrecoController, role admin.
@Controller('tabelas-preco')
export class TabelasPrecoController {
  constructor(private readonly tabelasPrecoService: TabelasPrecoService) {}

  @Get()
  listar(@Query() query: ListarTabelasPrecoQueryDto): Promise<TabelaPrecoResumoDto[]> {
    return this.tabelasPrecoService.listar(query);
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string): Promise<TabelaPrecoResumoDto> {
    return this.tabelasPrecoService.buscarPorId(id);
  }

  @Get(':id/itens')
  listarItens(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<ItemTabelaPrecoDto>> {
    return this.tabelasPrecoService.listarItens(id, query);
  }
}
