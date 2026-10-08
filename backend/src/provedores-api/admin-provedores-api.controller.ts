import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  AtualizarProvedorApiDto,
  CriarProvedorApiDto,
  ReordenarProvedoresApiDto,
} from './dto/provedor-api.dto';
import { FORMATOS_POR_TIPO, type ProvedorApiDto } from './provedor-api.types';
import { ProvedoresApiService } from './provedores-api.service';

// Protegido por requireAuth + requireRole('admin') (ver provedores-api.module.ts).
// Token nunca sai daqui (so' "tokenDefinido").
@Controller('admin/configuracoes/provedores-api')
export class AdminProvedoresApiController {
  constructor(private readonly provedores: ProvedoresApiService) {}

  @Get()
  listar(): Promise<ProvedorApiDto[]> {
    return this.provedores.listar();
  }

  // Formatos aceitos por tipo (popula o select "Formato" do painel).
  @Get('formatos')
  formatos(): Record<string, readonly string[]> {
    return FORMATOS_POR_TIPO;
  }

  @Post()
  criar(@Body() dto: CriarProvedorApiDto): Promise<ProvedorApiDto> {
    return this.provedores.criar(dto);
  }

  // Literal antes de ":id" (mesma cautela das chaves de LLM).
  @Patch('ordem')
  reordenar(@Body() dto: ReordenarProvedoresApiDto): Promise<ProvedorApiDto[]> {
    return this.provedores.reordenar(dto.tipo, dto.ids);
  }

  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() dto: AtualizarProvedorApiDto): Promise<ProvedorApiDto> {
    return this.provedores.atualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remover(@Param('id') id: string): Promise<void> {
    await this.provedores.remover(id);
  }
}
