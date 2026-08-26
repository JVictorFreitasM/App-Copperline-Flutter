import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { AtualizarHierarquiaVendedorDto } from './dto/atualizar-hierarquia-vendedor.dto';
import { VendedoresHierarquiaService } from './vendedores-hierarquia.service';
import type { VendedorHierarquiaDto, VendedorListaDto } from './vendedores-hierarquia.service';

// Endpoint administrativo (OS-BACKEND-22, GET adicionado na OS-WEB-21 pra
// alimentar a tabela editavel de /admin/vendedores) - protegido so por
// ApiKeyGuard, mesmo criterio de admin/llm e admin/sync. Hierarquia nao vem
// do WK Radar (ver skill wk-radar-client), por isso precisa de
// configuracao manual.
@Controller('admin/vendedores')
@UseGuards(ApiKeyGuard)
export class AdminVendedoresController {
  constructor(
    private readonly vendedoresHierarquiaService: VendedoresHierarquiaService,
  ) {}

  @Get()
  listar(): Promise<VendedorListaDto[]> {
    return this.vendedoresHierarquiaService.listar();
  }

  @Patch(':id/hierarquia')
  atualizarHierarquia(
    @Param('id') id: string,
    @Body() dto: AtualizarHierarquiaVendedorDto,
  ): Promise<VendedorHierarquiaDto> {
    return this.vendedoresHierarquiaService.atualizar(id, dto);
  }
}
