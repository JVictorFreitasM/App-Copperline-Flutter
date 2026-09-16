import { Controller, Get } from '@nestjs/common';
import type { CondicaoPagamentoDto, FormaPagamentoDto } from './dto/pagamento-response.dto';
import { PagamentoService } from './pagamento.service';

// Protegido por requireAuth via MiddlewareConsumer (ver pagamento.module.ts)
// - leitura aberta a qualquer usuario autenticado, mesmo criterio de
// TabelasPrecoController (catalogo de apoio, sem dado sensivel por
// cliente). Preparacao pro envio de pedido ao ERP - ver
// OS-pendentes-claude-code.md.
@Controller()
export class PagamentoController {
  constructor(private readonly pagamentoService: PagamentoService) {}

  @Get('formas-pagamento')
  listarFormasPagamento(): Promise<FormaPagamentoDto[]> {
    return this.pagamentoService.listarFormasPagamento();
  }

  @Get('condicoes-pagamento')
  listarCondicoesPagamento(): Promise<CondicaoPagamentoDto[]> {
    return this.pagamentoService.listarCondicoesPagamento();
  }
}
