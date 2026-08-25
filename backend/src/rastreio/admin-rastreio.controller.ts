import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ConsultarTrajetoQueryDto } from './dto/consultar-trajeto-query.dto';
import { RastreioService } from './rastreio.service';
import type { TrajetoVendedorDto } from './rastreio.service';

// Consumo do painel web (OS-WEB-24) - protegido so por ApiKeyGuard, mesmo
// criterio de admin/llm, admin/sync, admin/vendedores, etc.
@Controller('admin/rastreio')
@UseGuards(ApiKeyGuard)
export class AdminRastreioController {
  constructor(private readonly rastreioService: RastreioService) {}

  @Get()
  consultarTrajeto(
    @Query() query: ConsultarTrajetoQueryDto,
  ): Promise<TrajetoVendedorDto> {
    return this.rastreioService.consultarTrajeto(query.vendedorId, query.data);
  }
}
