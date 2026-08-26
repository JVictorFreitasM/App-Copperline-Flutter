import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ConsultarTrajetoQueryDto } from './dto/consultar-trajeto-query.dto';
import { RastreioService } from './rastreio.service';
import type { TrajetoVendedorDto } from './rastreio.service';

// Consulta administrativa/automacao (ex: suporte investigando um caso
// pontual) - protegido so por ApiKeyGuard, mesmo criterio de admin/llm,
// admin/sync, admin/vendedores, etc. NAO e' o que o painel web de OS-WEB-24
// consome (esse usa GET /rastreio/equipe* via sessao, escopado por
// hierarquia - ver rastreio.controller.ts) porque esta rota nao teria como
// saber "qual e' a equipe de quem esta chamando" (sem sessao/idpUser, so
// uma chave de API generica).
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
