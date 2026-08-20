import { Controller, Get, Param, Query } from '@nestjs/common';
import type { PaginatedResult } from '../common/pagination';
import { ProdutosService } from './produtos.service';
import type {
  ProdutoDetalheDto,
  ProdutoResumoDto,
} from './dto/produto-response.dto';
import { ListarProdutosQueryDto } from './dto/listar-produtos-query.dto';

// Protegido por requireAuth via MiddlewareConsumer (ver produtos.module.ts).
@Controller('produtos')
export class ProdutosController {
  constructor(private readonly produtosService: ProdutosService) {}

  @Get()
  listar(
    @Query() query: ListarProdutosQueryDto,
  ): Promise<PaginatedResult<ProdutoResumoDto>> {
    return this.produtosService.listar(query);
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string): Promise<ProdutoDetalheDto> {
    return this.produtosService.buscarPorId(id);
  }
}
