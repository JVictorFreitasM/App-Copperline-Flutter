import { Controller, Get, Header, Param, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { VisitaFotoStorageService } from './visita-foto-storage.service';
import { VisitasService } from './visitas.service';

// Consumo do painel web (supervisor revisando check-ins) - protegido so
// por ApiKeyGuard, mesmo criterio de admin/rastreio, admin/llm, etc.
@Controller('admin/visitas')
@UseGuards(ApiKeyGuard)
export class AdminVisitasController {
  constructor(
    private readonly visitasService: VisitasService,
    private readonly fotoStorageService: VisitaFotoStorageService,
  ) {}

  @Get(':id/foto')
  @Header('Content-Type', 'image/jpeg')
  async obterFoto(@Param('id') id: string): Promise<StreamableFile> {
    const caminho = await this.visitasService.obterCaminhoFoto(id);
    const buffer = await this.fotoStorageService.ler(caminho);
    return new StreamableFile(buffer);
  }
}
