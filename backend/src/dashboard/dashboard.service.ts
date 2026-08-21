import { Injectable } from '@nestjs/common';
import { TipoSituacaoPedido } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paraPedidoResumoDto } from '../pedidos/dto/pedido-response.dto';
import { paraNotaFiscalDto } from '../notas-fiscais/dto/nota-fiscal-response.dto';
import type { ResumoDashboardDto } from './dto/resumo-dashboard.dto';

const PERIODO_VALOR_FATURADO_DIAS = 30;
const QUANTIDADE_RECENTES = 5;

// Situacoes que ainda nao chegaram num estado final - nem concluido
// (FATURADO/ATENDIDO) nem encerrado sem sucesso (CANCELADO). Parcialmente
// faturado/atendido conta como "em aberto" (ainda falta concluir).
const SITUACOES_EM_ABERTO: TipoSituacaoPedido[] = [
  TipoSituacaoPedido.EM_ANALISE,
  TipoSituacaoPedido.BLOQUEADO,
  TipoSituacaoPedido.PENDENTE,
  TipoSituacaoPedido.PARCIALMENTE_FATURADO,
  TipoSituacaoPedido.PARCIALMENTE_ATENDIDO,
];

const SITUACOES_FATURADAS: TipoSituacaoPedido[] = [
  TipoSituacaoPedido.FATURADO,
  TipoSituacaoPedido.ATENDIDO,
];

const INCLUDE_PEDIDOS_COM_CLIENTE = {
  pedidos: { include: { pedido: { include: { cliente: true } } } },
} as const;

// So leitura/agregacao sobre dado ja sincronizado - sem regra de negocio
// (as contagens/somas nao decidem nada, so exibem), entao sem entidade de
// dominio (ver skill nest-endpoint, criterio de DDD).
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async obterResumo(): Promise<ResumoDashboardDto> {
    const desde = new Date();
    desde.setDate(desde.getDate() - PERIODO_VALOR_FATURADO_DIAS);

    const [
      clientesAtivos,
      produtosAtivos,
      pedidosEmAberto,
      somaFaturado,
      pedidosRecentes,
      notasFiscaisRecentes,
    ] = await this.prisma.$transaction([
      this.prisma.cliente.count({ where: { inativo: false } }),
      this.prisma.produto.count({ where: { inativo: false } }),
      this.prisma.pedido.count({
        where: { situacao: { in: SITUACOES_EM_ABERTO } },
      }),
      this.prisma.pedido.aggregate({
        where: {
          situacao: { in: SITUACOES_FATURADAS },
          dataHoraUltimaAlteracao: { gte: desde },
        },
        _sum: { valorTotal: true },
      }),
      this.prisma.pedido.findMany({
        take: QUANTIDADE_RECENTES,
        orderBy: { dataHoraUltimaAlteracao: 'desc' },
        include: { cliente: true },
      }),
      this.prisma.notaFiscal.findMany({
        take: QUANTIDADE_RECENTES,
        orderBy: { dataEmissao: 'desc' },
        include: INCLUDE_PEDIDOS_COM_CLIENTE,
      }),
    ]);

    return {
      clientesAtivos,
      produtosAtivos,
      pedidosEmAberto,
      valorFaturadoRecente: (somaFaturado._sum.valorTotal ?? 0).toString(),
      periodoValorFaturadoDias: PERIODO_VALOR_FATURADO_DIAS,
      pedidosRecentes: pedidosRecentes.map(paraPedidoResumoDto),
      notasFiscaisRecentes: notasFiscaisRecentes.map(paraNotaFiscalDto),
    };
  }
}
