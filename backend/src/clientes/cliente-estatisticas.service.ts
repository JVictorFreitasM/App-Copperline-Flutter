import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  construirWhereClientePorEscopo,
  type EscopoClientes,
} from '../vendedores/vendedor-escopo.service';

export interface ClienteEstatisticasDto {
  clienteId: string;
  meses: number;
  totalUltimosMeses: number;
  totalGeral: number;
  quantidadePedidos: number;
  ticketMedio: number;
  vendedorResponsavel: string | null;
}

// Todos os agregados vem de Pedido, NUNCA de NotaFiscal (criterio de
// aceite desta OS) - NotaFiscalSyncStrategy so reprocessa uma janela fixa
// dos ultimos 60 dias (ver nota-fiscal.sync.ts, JANELA_FIXA_DIARIA), entao
// "total geral" a partir de nota fiscal subestimaria qualquer historico
// mais antigo que isso. Pedido nao tem essa limitacao (cursor incremental
// desde a carga inicial, ver WK_RADAR_PEDIDO_DATA_INICIO_CARGA).
//
// Filtros aplicados em TODOS os agregados (nao so exibicao - afeta o
// calculo em si):
// - situacao != CANCELADO (decisao confirmada com o usuario: pedido
//   cancelado nao e' compra de verdade, fica fora do total e do ticket
//   medio). Prisma `not` inclui linhas com situacao NULL (pedido local
//   recem-criado, ainda sem sync real - ver OS-BACKEND-25), o que e' o
//   comportamento certo aqui.
// - statusLocal != AGUARDANDO_APROVACAO (OS-BACKEND-25) - pedido ainda
//   nao confirmado no ERP nao e' compra realizada.
// - incompleto: false - stub criado por NotaFiscalSyncStrategy referenciando
//   um pedido ainda nao sincronizado (ver pedido.sync.ts) nao tem
//   valorTotal real, nao deve contar.
@Injectable()
export class ClienteEstatisticasService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(
    clienteId: string,
    meses: number,
    escopo: EscopoClientes,
  ): Promise<ClienteEstatisticasDto> {
    const whereEscopo = construirWhereClientePorEscopo(escopo);
    if (whereEscopo === null) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }

    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, ...whereEscopo },
      select: {
        id: true,
        vendedores: {
          take: 1,
          orderBy: { criadoEm: 'asc' },
          select: { vendedor: { select: { nome: true } } },
        },
      },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente '${clienteId}' não encontrado`);
    }

    const wherePedidosValidos: Prisma.PedidoWhereInput = {
      clienteId,
      incompleto: false,
      situacao: { not: 'CANCELADO' },
      statusLocal: { not: 'AGUARDANDO_APROVACAO' },
    };

    const desde = new Date();
    desde.setMonth(desde.getMonth() - meses);

    const [agregadoGeral, agregadoUltimosMeses] = await Promise.all([
      this.prisma.pedido.aggregate({
        where: wherePedidosValidos,
        _sum: { valorTotal: true },
        _count: true,
      }),
      this.prisma.pedido.aggregate({
        where: {
          ...wherePedidosValidos,
          dataHoraUltimaAlteracao: { gte: desde },
        },
        _sum: { valorTotal: true },
      }),
    ]);

    const totalGeral = agregadoGeral._sum.valorTotal?.toNumber() ?? 0;
    const quantidadePedidos = agregadoGeral._count;
    const ticketMedio = quantidadePedidos > 0 ? totalGeral / quantidadePedidos : 0;

    return {
      clienteId,
      meses,
      totalUltimosMeses: agregadoUltimosMeses._sum.valorTotal?.toNumber() ?? 0,
      totalGeral,
      quantidadePedidos,
      ticketMedio: arredondarMoeda(ticketMedio),
      vendedorResponsavel: cliente.vendedores[0]?.vendedor.nome ?? null,
    };
  }
}

function arredondarMoeda(valor: number): number {
  return Math.round(valor * 100) / 100;
}
