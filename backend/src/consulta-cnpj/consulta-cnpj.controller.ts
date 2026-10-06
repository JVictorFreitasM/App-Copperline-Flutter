import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { ConsultaCnpjService } from './consulta-cnpj.service';
import type { ConsultaCnpjResultadoDto } from './dto/consulta-cnpj-response.dto';

// Protegido por requireAuth via MiddlewareConsumer (ver
// consulta-cnpj.module.ts). Limite por usuario pra um so nao consumir a
// cota do provedor externo (limite proprio de req/s) de todo mundo.
@Controller('consulta-cnpj')
export class ConsultaCnpjController {
  constructor(private readonly consultaCnpjService: ConsultaCnpjService) {}

  @Get(':cnpj')
  @UseGuards(RateLimitGuard)
  @RateLimit({ prefixo: 'consulta-cnpj', limite: 10, janelaSegundos: 60 })
  consultar(@Param('cnpj') cnpj: string): Promise<ConsultaCnpjResultadoDto> {
    return this.consultaCnpjService.consultar(cnpj);
  }
}
