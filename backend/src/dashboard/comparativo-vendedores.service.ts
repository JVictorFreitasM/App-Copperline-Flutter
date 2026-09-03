import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VendedorVendasService } from '../vendedores/vendedor-vendas.service';
import type { ComparativoVendedorDto } from './dto/comparativo-vendedores.dto';

// OS-WEB-40 - radar comparando 2-4 vendedores em 4 eixos: valor vendido,
// ticket medio, taxa de aprovacao de desconto e quantidade de visitas
// realizadas, todos no mesmo periodo. Puramente leitura/agregacao (sem
// decisao de negocio) - por isso sem entidade de dominio, so orquestra 3
// queries independentes por eixo.
@Injectable()
export class ComparativoVendedoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vendedorVendasService: VendedorVendasService,
  ) {}

  async obter(
    vendedorIds: string[],
    periodo: { gte?: Date; lte?: Date },
  ): Promise<ComparativoVendedorDto[]> {
    const [vendedores, vendasPorVendedor, solicitacoesPorVendedor, visitasPorVendedor] =
      await Promise.all([
        this.prisma.vendedor.findMany({
          where: { id: { in: vendedorIds } },
          select: { id: true, nome: true },
        }),
        this.vendedorVendasService.valorEQuantidadePorVendedor(periodo),
        this.obterSolicitacoesPorVendedor(vendedorIds, periodo),
        this.obterVisitasPorVendedor(vendedorIds, periodo),
      ]);

    const nomePorId = new Map(vendedores.map((v) => [v.id, v.nome]));

    return vendedorIds.map((vendedorId) => {
      const vendas = vendasPorVendedor.get(vendedorId);
      const solicitacoes = solicitacoesPorVendedor.get(vendedorId);
      const decididas = (solicitacoes?.aprovadas ?? 0) + (solicitacoes?.rejeitadas ?? 0);

      return {
        vendedorId,
        nome: nomePorId.get(vendedorId) ?? null,
        valorVendido: vendas?.valor ?? 0,
        ticketMedio: vendas && vendas.quantidade > 0 ? vendas.valor / vendas.quantidade : 0,
        taxaAprovacaoDesconto:
          decididas > 0 ? ((solicitacoes?.aprovadas ?? 0) / decididas) * 100 : null,
        quantidadeVisitas: visitasPorVendedor.get(vendedorId) ?? 0,
      };
    });
  }

  private async obterSolicitacoesPorVendedor(
    vendedorIds: string[],
    periodo: { gte?: Date; lte?: Date },
  ): Promise<Map<string, { aprovadas: number; rejeitadas: number }>> {
    const agrupado = await this.prisma.solicitacaoDesconto.groupBy({
      by: ['vendedorSolicitanteId', 'status'],
      where: {
        vendedorSolicitanteId: { in: vendedorIds },
        status: { in: ['APROVADO', 'REJEITADO'] },
        criadoEm: periodo,
      },
      _count: true,
    });

    const resultado = new Map<string, { aprovadas: number; rejeitadas: number }>();
    for (const linha of agrupado) {
      const atual = resultado.get(linha.vendedorSolicitanteId) ?? {
        aprovadas: 0,
        rejeitadas: 0,
      };
      if (linha.status === 'APROVADO') {
        atual.aprovadas += linha._count;
      } else {
        atual.rejeitadas += linha._count;
      }
      resultado.set(linha.vendedorSolicitanteId, atual);
    }
    return resultado;
  }

  private async obterVisitasPorVendedor(
    vendedorIds: string[],
    periodo: { gte?: Date; lte?: Date },
  ): Promise<Map<string, number>> {
    const agrupado = await this.prisma.visita.groupBy({
      by: ['vendedorId'],
      where: {
        vendedorId: { in: vendedorIds },
        checkinEm: periodo,
        canceladaEm: null,
      },
      _count: true,
    });
    return new Map(agrupado.map((linha) => [linha.vendedorId, linha._count]));
  }
}
