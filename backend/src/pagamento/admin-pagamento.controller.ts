import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { AtualizarAtivoPagamentoDto } from './dto/atualizar-ativo-pagamento.dto';
import type {
  AdminCondicaoPagamentoDto,
  AdminFormaPagamentoDto,
} from './dto/pagamento-response.dto';
import { PagamentoService } from './pagamento.service';

// Protegido por requireAuth + requireRole('admin') via MiddlewareConsumer
// (ver pagamento.module.ts) - mesmo criterio de
// AdminTiposAcondicionamentoController: catalogo sincronizado, painel so
// liga/desliga desativadaManualmente (nunca mexe no dado vindo do Radar).
@Controller('admin')
export class AdminPagamentoController {
  constructor(private readonly pagamentoService: PagamentoService) {}

  @Get('formas-pagamento')
  listarFormasPagamento(): Promise<AdminFormaPagamentoDto[]> {
    return this.pagamentoService.listarTodasFormasPagamento();
  }

  @Patch('formas-pagamento/:id')
  atualizarFormaPagamento(
    @Param('id') id: string,
    @Body() dto: AtualizarAtivoPagamentoDto,
  ): Promise<AdminFormaPagamentoDto> {
    return this.pagamentoService.atualizarAtivoFormaPagamento(id, dto.ativo);
  }

  @Get('condicoes-pagamento')
  listarCondicoesPagamento(): Promise<AdminCondicaoPagamentoDto[]> {
    return this.pagamentoService.listarTodasCondicoesPagamento();
  }

  @Patch('condicoes-pagamento/:id')
  atualizarCondicaoPagamento(
    @Param('id') id: string,
    @Body() dto: AtualizarAtivoPagamentoDto,
  ): Promise<AdminCondicaoPagamentoDto> {
    return this.pagamentoService.atualizarAtivoCondicaoPagamento(id, dto.ativo);
  }
}
