import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Soma de Pedido.valorTotal por vendedor NUM PERIODO, atribuido via vinculo
// Cliente-Vendedor (ver dashboard.service.ts, obterRanking/topVendedores,
// mesmo motivo: Pedido.vendedorId so existe pra pedido criado localmente
// pelo app, ainda bloqueado pela OS-BACKEND-25 - hoje todo pedido vem de
// sync do ERP e teria vendedorId nulo). ClienteVendedor e' N:N no schema
// mas na pratica um cliente so negocia com um vendedor (confirmado com o
// usuario) - o primeiro vinculo (mais antigo) de cada cliente e' o
// vendedor responsavel. Extraido como service proprio (nao duplicado
// dentro de dashboard.service.ts) pra ser reaproveitado por metas
// (OS-BACKEND-44, valor vendido no mes vs meta / ranking de equipe).
@Injectable()
export class VendedorVendasService {
  constructor(private readonly prisma: PrismaService) {}

  async valorVendidoPorVendedor(periodo: {
    gte?: Date;
    lte?: Date;
  }): Promise<Map<string, number>> {
    const detalhado = await this.valorEQuantidadePorVendedor(periodo);
    const valorPorVendedor = new Map<string, number>();
    for (const [vendedorId, dados] of detalhado) {
      valorPorVendedor.set(vendedorId, dados.valor);
    }
    return valorPorVendedor;
  }

  // OS-WEB-40 - alem do valor (ja usado por metas/ranking), o comparativo
  // de vendedores tambem precisa da CONTAGEM de pedidos no periodo pra
  // calcular ticket medio (valor / quantidade) - por isso agrupado junto
  // aqui, em vez de duas queries separadas.
  async valorEQuantidadePorVendedor(periodo: {
    gte?: Date;
    lte?: Date;
  }): Promise<Map<string, { valor: number; quantidade: number }>> {
    const clientesAgrupado = await this.prisma.pedido.groupBy({
      by: ['clienteId'],
      where: { clienteId: { not: null }, dataHoraUltimaAlteracao: periodo },
      _sum: { valorTotal: true },
      _count: true,
    });
    if (clientesAgrupado.length === 0) {
      return new Map();
    }

    const vendedorIdPorCliente = await this.resolverVendedorPorCliente(
      clientesAgrupado.map((c) => c.clienteId as string),
    );

    const resultado = new Map<string, { valor: number; quantidade: number }>();
    for (const linha of clientesAgrupado) {
      const vendedorId = vendedorIdPorCliente.get(linha.clienteId as string);
      if (!vendedorId) {
        continue;
      }
      const atual = resultado.get(vendedorId) ?? { valor: 0, quantidade: 0 };
      resultado.set(vendedorId, {
        valor: atual.valor + Number(linha._sum.valorTotal ?? 0),
        quantidade: atual.quantidade + linha._count,
      });
    }
    return resultado;
  }

  // Meta tipo PESO (pedido do usuario, 2026-09-28) - mesma atribuicao
  // cliente->vendedor de valorEQuantidadePorVendedor acima, somando
  // Pedido.pesoLiquidoTotalKg em vez de valorTotal. null pra pedido
  // sincronizado do Radar (nunca calculado nesse caminho, ver
  // CriarPedidoService) - excluido da soma, nao tratado como zero.
  async pesoVendidoPorVendedor(periodo: {
    gte?: Date;
    lte?: Date;
  }): Promise<Map<string, number>> {
    const clientesAgrupado = await this.prisma.pedido.groupBy({
      by: ['clienteId'],
      where: { clienteId: { not: null }, dataHoraUltimaAlteracao: periodo },
      _sum: { pesoLiquidoTotalKg: true },
    });
    if (clientesAgrupado.length === 0) {
      return new Map();
    }

    const vendedorIdPorCliente = await this.resolverVendedorPorCliente(
      clientesAgrupado.map((c) => c.clienteId as string),
    );

    const resultado = new Map<string, number>();
    for (const linha of clientesAgrupado) {
      const vendedorId = vendedorIdPorCliente.get(linha.clienteId as string);
      if (!vendedorId) {
        continue;
      }
      const atual = resultado.get(vendedorId) ?? 0;
      resultado.set(vendedorId, atual + Number(linha._sum.pesoLiquidoTotalKg ?? 0));
    }
    return resultado;
  }

  // ClienteVendedor e' N:N no schema mas na pratica um cliente so negocia
  // com um vendedor (confirmado com o usuario) - o primeiro vinculo (mais
  // antigo) de cada cliente e' o vendedor responsavel.
  private async resolverVendedorPorCliente(
    clienteIds: string[],
  ): Promise<Map<string, string>> {
    const vinculos = await this.prisma.clienteVendedor.findMany({
      where: { clienteId: { in: clienteIds } },
      orderBy: { criadoEm: 'asc' },
      select: { clienteId: true, vendedorId: true },
    });
    const vendedorIdPorCliente = new Map<string, string>();
    for (const vinculo of vinculos) {
      if (!vendedorIdPorCliente.has(vinculo.clienteId)) {
        vendedorIdPorCliente.set(vinculo.clienteId, vinculo.vendedorId);
      }
    }
    return vendedorIdPorCliente;
  }
}
