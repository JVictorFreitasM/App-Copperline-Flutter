import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { ConsultaCepService } from './consulta-cep.service';
import type { ConsultaCepDto } from './dto/consulta-cep-response.dto';

// Protegido por requireAuth via MiddlewareConsumer (ver
// consulta-cep.module.ts). Limite por usuario, mesmo raciocinio do
// consulta-cnpj.
@Controller('consulta-cep')
export class ConsultaCepController {
  constructor(private readonly consultaCepService: ConsultaCepService) {}

  @Get(':cep')
  @UseGuards(RateLimitGuard)
  @RateLimit({ prefixo: 'consulta-cep', limite: 30, janelaSegundos: 60 })
  consultar(@Param('cep') cep: string): Promise<ConsultaCepDto> {
    return this.consultaCepService.consultar(cep);
  }
}
