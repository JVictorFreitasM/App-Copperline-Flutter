import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ImportarSwaggerDto } from './dto/importar-swagger.dto';
import { SwaggerImportService } from './swagger-import.service';
import type { ImportarSwaggerResultado } from './swagger-import.service';

// OS-BACKEND-30 - ferramenta administrativa (nao um CRUD de negocio), mesmo
// criterio de guard de admin/sync, admin/llm, admin/rastreio: ApiKeyGuard,
// nao requireAuth (uso por quem mantem o backend, nao por vendedor/supervisor
// logado).
@Controller('admin/endpoints')
@UseGuards(ApiKeyGuard)
export class AdminEndpointsController {
  constructor(private readonly swaggerImportService: SwaggerImportService) {}

  @Post('importar-swagger')
  importarSwagger(@Body() dto: ImportarSwaggerDto): Promise<ImportarSwaggerResultado> {
    return this.swaggerImportService.importar(dto.swaggerUrl, dto.caminhoEndpoint, dto.nomeEntidade);
  }
}
