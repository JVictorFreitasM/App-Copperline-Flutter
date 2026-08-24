import { Controller, Get, Query } from '@nestjs/common';
import { BuscaService } from './busca.service';
import { BuscaQueryDto } from './dto/busca-query.dto';
import type { BuscaResultadoDto } from './dto/busca-resultado.dto';

// Protegido por requireAuth via MiddlewareConsumer (ver busca.module.ts,
// mesmo padrao das demais). Busca global unificada (OS-BACKEND-18) - pro
// mobile (e opcionalmente web), cliente/produto/pedido numa chamada so.
@Controller('busca')
export class BuscaController {
  constructor(private readonly buscaService: BuscaService) {}

  @Get()
  buscar(@Query() query: BuscaQueryDto): Promise<BuscaResultadoDto> {
    return this.buscaService.buscar(query.q);
  }
}
