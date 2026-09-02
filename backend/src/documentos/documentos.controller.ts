import { Controller, Get, Param, Query, StreamableFile } from '@nestjs/common';
import type { PaginatedResult } from '../common/pagination';
import type { DocumentoDto } from './dto/documento-response.dto';
import type { ListarDocumentosQueryDto } from './dto/listar-documentos-query.dto';
import { DocumentosService } from './documentos.service';

// Protegido por requireAuth via MiddlewareConsumer (ver documentos.module.ts)
// - sem role especifica, qualquer vendedor autenticado consulta/baixa
// (mesmo criterio de leitura de NotasFiscaisController). Upload fica em
// AdminDocumentosController (role admin), controller separado.
@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Get()
  listar(
    @Query() query: ListarDocumentosQueryDto,
  ): Promise<PaginatedResult<DocumentoDto>> {
    return this.documentosService.listar(query);
  }

  @Get(':id/download')
  async download(@Param('id') id: string): Promise<StreamableFile> {
    const { buffer, nome, tipoMime } = await this.documentosService.obterParaDownload(id);
    return new StreamableFile(buffer, {
      type: tipoMime,
      disposition: `attachment; filename="${encodeURIComponent(nome)}"`,
    });
  }
}
