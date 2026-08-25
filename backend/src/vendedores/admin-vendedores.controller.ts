import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { AtualizarHierarquiaVendedorDto } from './dto/atualizar-hierarquia-vendedor.dto';
import { VendedoresHierarquiaService } from './vendedores-hierarquia.service';
import type { VendedorHierarquiaDto } from './vendedores-hierarquia.service';

// Endpoint administrativo (OS-BACKEND-22) - protegido so por ApiKeyGuard,
// mesmo criterio de admin/llm e admin/sync. Hierarquia nao vem do WK Radar
// (ver skill wk-radar-client), por isso precisa de configuracao manual.
@Controller('admin/vendedores')
@UseGuards(ApiKeyGuard)
export class AdminVendedoresController {
  constructor(
    private readonly vendedoresHierarquiaService: VendedoresHierarquiaService,
  ) {}

  @Patch(':id/hierarquia')
  atualizarHierarquia(
    @Param('id') id: string,
    @Body() dto: AtualizarHierarquiaVendedorDto,
  ): Promise<VendedorHierarquiaDto> {
    return this.vendedoresHierarquiaService.atualizar(id, dto);
  }
}
