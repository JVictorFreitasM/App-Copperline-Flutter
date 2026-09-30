import { Injectable, Logger } from '@nestjs/common';
import type { RelatorioVendedorDto } from '../pedidos/dto/relatorio-pedidos-response.dto';
import { RelatorioPedidosService } from '../pedidos/relatorio-pedidos.service';
import { PrismaService } from '../prisma/prisma.service';
import { registrarEventoNotificacao } from './evento-notificacao.service';

export type MomentoRelatorioDiario = 'MANHA' | 'FIM_DIA';

// Push diario de pedidos por vendedor (pedido do usuario, 2026-09-29) -
// disparado pelo scheduler (ver relatorio-diario-notificacao.scheduler.ts,
// dias uteis, 7h/18h horario de Brasilia). So dispara pra vendedor com
// PELO MENOS 1 pedido no dia OU 1 pendencia atual - decisao confirmada
// (nunca "0 pedidos hoje" - vira ruido). Sem resumo agregado pro
// supervisor por enquanto (mesmo escopo da decisao original).
@Injectable()
export class RelatorioDiarioNotificacaoService {
  private readonly logger = new Logger(RelatorioDiarioNotificacaoService.name);

  constructor(
    private readonly relatorioPedidosService: RelatorioPedidosService,
    private readonly prisma: PrismaService,
  ) {}

  async gerar(momento: MomentoRelatorioDiario): Promise<void> {
    const vendedores = await this.relatorioPedidosService.obterParaVendedoresAtivos();
    const comAtividade = vendedores.filter(
      (vendedor) => vendedor.totalPedidos > 0 || vendedor.pendentesAtuais > 0,
    );

    for (const vendedor of comAtividade) {
      try {
        await this.registrarEvento(momento, vendedor);
      } catch (error) {
        // Um vendedor com falha (ex: erro transitorio de banco) nunca
        // deve impedir o resto do lote - mesmo criterio de tolerancia a
        // falha pontual ja usado em SyncService/CriarItensPedido.
        this.logger.error(
          `Falha ao registrar relatorio diario (${momento}) do vendedor '${vendedor.vendedorId}'`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    this.logger.log(
      `Relatorio diario (${momento}): ${comAtividade.length} de ${vendedores.length} vendedor(es) com atividade`,
    );
  }

  private async registrarEvento(
    momento: MomentoRelatorioDiario,
    vendedor: RelatorioVendedorDto,
  ): Promise<void> {
    const { titulo, corpo } = montarMensagem(momento, vendedor);
    await this.prisma.$transaction((tx) =>
      registrarEventoNotificacao(tx, {
        tipo: momento === 'MANHA' ? 'RELATORIO_MANHA_PEDIDOS' : 'RELATORIO_FIM_DIA_PEDIDOS',
        referenciaId: vendedor.vendedorId,
        titulo,
        corpo,
        dados: { vendedorId: vendedor.vendedorId },
      }),
    );
  }
}

function montarMensagem(
  momento: MomentoRelatorioDiario,
  vendedor: RelatorioVendedorDto,
): { titulo: string; corpo: string } {
  const pendenteTexto =
    vendedor.pendentesAtuais > 0
      ? `, ${vendedor.pendentesAtuais} aguardando aprovação`
      : '';

  if (momento === 'MANHA') {
    return {
      titulo: 'Resumo do dia',
      corpo: `Você tem ${vendedor.totalPedidos} pedido(s) hoje${pendenteTexto}.`,
    };
  }

  return {
    titulo: 'Fechamento do dia',
    corpo: `Hoje você teve ${vendedor.totalPedidos} pedido(s)${pendenteTexto}.`,
  };
}
