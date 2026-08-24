import { Controller, Get, Param, Query } from '@nestjs/common';
import { ClienteResumoLlmService } from './cliente-resumo-llm.service';
import type { ClienteResumoLlmDto } from './cliente-resumo-llm.service';
import { ClientesService } from './clientes.service';
import type {
  ClienteDetalheDto,
  ClienteResumoDto,
} from './dto/cliente-response.dto';
import { ListarClientesQueryDto } from './dto/listar-clientes-query.dto';
import type { PaginatedResult } from '../common/pagination';

// Protegido por requireAuth via MiddlewareConsumer (ver clientes.module.ts,
// mesmo padrao da OS 03) - sem role especifica, qualquer usuario autenticado
// le a lista (dado compartilhado da empresa, sem conceito de "dono").
@Controller('clientes')
export class ClientesController {
  constructor(
    private readonly clientesService: ClientesService,
    private readonly clienteResumoLlmService: ClienteResumoLlmService,
  ) {}

  @Get()
  listar(
    @Query() query: ListarClientesQueryDto,
  ): Promise<PaginatedResult<ClienteResumoDto>> {
    return this.clientesService.listar(query);
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string): Promise<ClienteDetalheDto> {
    return this.clientesService.buscarPorId(id);
  }

  // OS-BACKEND-20 - "/:id/resumo" e' mais especifico que "/:id" (3
  // segmentos vs 2), sem risco de colisao independente da ordem de
  // declaracao (diferente do caso de /produtos/favoritos, ver
  // produtos.controller.ts).
  @Get(':id/resumo')
  obterResumo(@Param('id') id: string): Promise<ClienteResumoLlmDto> {
    return this.clienteResumoLlmService.obterResumo(id);
  }
}
