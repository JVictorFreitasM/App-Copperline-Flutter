import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ConsultarTrajetoDataQueryDto } from './dto/consultar-trajeto-data-query.dto';
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

  // OS-BACKEND-37 - forma literal pedida pela OS (path param + 'percurso'),
  // mantida ao lado da rota acima (raiz com querystring) por retrocompat -
  // mesmo RastreioService.consultarTrajeto, so muda a forma da URL.
  @Get(':vendedorId/percurso')
  consultarPercurso(
    @Param('vendedorId') vendedorId: string,
    @Query() query: ConsultarTrajetoDataQueryDto,
  ): Promise<TrajetoVendedorDto> {
    return this.rastreioService.consultarTrajeto(vendedorId, query.data);
  }
}
