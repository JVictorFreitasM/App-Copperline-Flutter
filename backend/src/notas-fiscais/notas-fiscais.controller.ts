import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  NotasFiscaisService,
  type ListaNotasFiscaisDto,
} from './notas-fiscais.service';
import type { NotaFiscalDto } from './dto/nota-fiscal-response.dto';
import { ListarNotasFiscaisQueryDto } from './dto/listar-notas-fiscais-query.dto';

// Protegido por requireAuth via MiddlewareConsumer (ver notas-fiscais.module.ts,
// mesmo padrao da OS-BACKEND-11) - sem role especifica, qualquer usuario
// autenticado le a lista (dado compartilhado da empresa, sem conceito de
// "dono").
@Controller('notas-fiscais')
export class NotasFiscaisController {
  constructor(private readonly notasFiscaisService: NotasFiscaisService) {}

  @Get()
  listar(
    @Query() query: ListarNotasFiscaisQueryDto,
  ): Promise<ListaNotasFiscaisDto> {
    return this.notasFiscaisService.listar(query);
  }

  @Get(':id')
  buscarPorId(@Param('id') id: string): Promise<NotaFiscalDto> {
    return this.notasFiscaisService.buscarPorId(id);
  }
}
