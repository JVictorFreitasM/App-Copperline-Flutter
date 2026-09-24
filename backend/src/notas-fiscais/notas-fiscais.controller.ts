import { Controller, Get, Param, Query, StreamableFile } from '@nestjs/common';
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

  // "/:id/pdf" depois de "/:id" (GET simples) nunca colide - metodos e
  // numero de segmentos diferentes, ao contrario do caso "/relatorio" vs
  // "/:id" em pedidos.controller.ts. `inline` (nao `attachment`) - abre no
  // visualizador de PDF do proprio navegador, cobrindo visualizacao E
  // impressao (Ctrl+P do visualizador) sem forcar download; o usuario
  // ainda pode salvar a partir do visualizador se quiser exportar.
  @Get(':id/pdf')
  async obterPdf(@Param('id') id: string): Promise<StreamableFile> {
    const { buffer, nomeArquivo } = await this.notasFiscaisService.obterPdf(id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${encodeURIComponent(nomeArquivo)}"`,
    });
  }
}
