import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { CoberturaTemporariaService } from './cobertura-temporaria.service';
import type { CoberturaTemporariaDto } from './cobertura-temporaria.service';
import { CriarCoberturaDto } from './dto/criar-cobertura.dto';

// OS-BACKEND-48 - protegido so por ApiKeyGuard (mesmo criterio de
// admin/vendedores/:id/hierarquia e admin/vendedores/:id/meta - cobertura
// nao vem do Radar, e' configuracao manual de gestao).
@Controller('admin/coberturas')
@UseGuards(ApiKeyGuard)
export class AdminCoberturasController {
  constructor(private readonly coberturaTemporariaService: CoberturaTemporariaService) {}

  @Get()
  listar(): Promise<CoberturaTemporariaDto[]> {
    return this.coberturaTemporariaService.listar();
  }

  @Post()
  criar(@Body() dto: CriarCoberturaDto): Promise<CoberturaTemporariaDto> {
    return this.coberturaTemporariaService.criar(dto);
  }
}
