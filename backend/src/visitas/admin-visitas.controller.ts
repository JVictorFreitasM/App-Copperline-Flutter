import { Controller, Get, Header, Param, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { VisitaFotoStorageService } from './visita-foto-storage.service';
import { VisitasService } from './visitas.service';

// Consulta administrativa/automacao (ex: suporte investigando um caso
// pontual) - protegido so por ApiKeyGuard, mesmo criterio de admin/rastreio,
// admin/llm, etc. NAO e' o que o painel web de OS-WEB-26 consome (esse usa
// GET /visitas/:id/foto via sessao, escopado por hierarquia - ver
// visitas.controller.ts) porque esta rota nao teria como saber "essa foto
// e' de alguem da equipe de quem esta chamando" (sem sessao/idpUser, so
// uma chave de API generica).
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
