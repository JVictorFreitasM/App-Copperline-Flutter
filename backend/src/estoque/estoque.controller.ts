import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { EstoqueService } from './estoque.service';
import type { EstoqueConsultaDto } from './dto/estoque-response.dto';

// Protegido por requireAuth via MiddlewareConsumer (ver estoque.module.ts).
@Controller('estoque')
export class EstoqueController {
  constructor(private readonly estoqueService: EstoqueService) {}

  // RateLimitGuard so age em cima de um usuario ja autenticado
  // (request.user), por isso vem depois de requireAuth no pipeline -
  // limite por usuario, nao global, pra nao punir todo mundo por causa de
  // um so cliente com uso abusivo. Desde a sincronizacao de saldo de
  // estoque, este endpoint le so a tabela local (SaldoEstoque) - o limite
  // deixou de proteger o Executivo.svc (nao e mais chamado aqui) e passou
  // a ser so uma protecao generica de API, mantida por precaucao.
  @Get(':identificador')
  @UseGuards(RateLimitGuard)
  @RateLimit({ prefixo: 'estoque', limite: 30, janelaSegundos: 60 })
  consultar(
    @Param('identificador') identificador: string,
  ): Promise<EstoqueConsultaDto> {
    return this.estoqueService.consultarPorIdentificador(identificador);
  }
}
