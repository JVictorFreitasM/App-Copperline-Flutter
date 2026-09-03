import { Injectable } from '@nestjs/common';
import { TipoSituacaoPedido } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paraPedidoResumoDto } from '../pedidos/dto/pedido-response.dto';
import { paraNotaFiscalDto } from '../notas-fiscais/dto/nota-fiscal-response.dto';
import { montarFunilPedidos } from './domain/montar-funil-pedidos';
import { filtroPeriodo } from './filtro-periodo';
import type { EstoqueCriticoQueryDto, EstoqueCriticoDashboardDto } from './dto/estoque-critico-dashboard.dto';
import type { FunilPedidosDashboardDto } from './dto/funil-pedidos-dashboard.dto';
import type { NotasFiscaisDashboardDto } from './dto/notas-fiscais-dashboard.dto';
import type { RankingDashboardDto, RankingQueryDto } from './dto/ranking-dashboard.dto';
import type { PeriodoQueryDto } from './dto/periodo-query.dto';
import type { ResumoDashboardDto } from './dto/resumo-dashboard.dto';
import type { VendasDashboardDto } from './dto/vendas-dashboard.dto';

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

  async obterVendas(query: PeriodoQueryDto): Promise<VendasDashboardDto> {
    const where = {
      dataHoraUltimaAlteracao: filtroPeriodo(query.dataInicial, query.dataFinal),
    };

    const [agregado, porSituacao] = await this.prisma.$transaction([
      this.prisma.pedido.aggregate({
        where,
        _count: true,
        _sum: { valorTotal: true },
      }),
      this.prisma.pedido.groupBy({
        by: ['situacao'],
        where,
        orderBy: { situacao: 'asc' },
        _count: true,
      }),
    ]);

    const totalPedidos = agregado._count;
    const valorTotal = agregado._sum.valorTotal ?? 0;

    return {
      periodo: { dataInicial: query.dataInicial ?? null, dataFinal: query.dataFinal ?? null },
      totalPedidos,
      valorTotal: valorTotal.toString(),
      ticketMedio:
        totalPedidos === 0 ? '0' : (Number(valorTotal) / totalPedidos).toFixed(2),
      contagemPorSituacao: porSituacao.map((linha) => ({
        situacao: linha.situacao,
        quantidade: linha._count as unknown as number,
      })),
    };
  }

  // OS-WEB-41 - reaproveita a mesma contagem por situacao de obterVendas
  // acima, so' reorganizada em etapas (ver montarFunilPedidos - regra
  // deterministica, testada isoladamente).
  async obterFunilPedidos(query: PeriodoQueryDto): Promise<FunilPedidosDashboardDto> {
    const where = {
      dataHoraUltimaAlteracao: filtroPeriodo(query.dataInicial, query.dataFinal),
    };

    const porSituacao = await this.prisma.pedido.groupBy({
      by: ['situacao'],
      where,
      _count: true,
    });

    const funil = montarFunilPedidos(
      porSituacao.map((linha) => ({
        situacao: linha.situacao,
        quantidade: linha._count as unknown as number,
      })),
    );

    return {
      periodo: { dataInicial: query.dataInicial ?? null, dataFinal: query.dataFinal ?? null },
      ...funil,
    };
  }

  async obterRanking(query: RankingQueryDto): Promise<RankingDashboardDto> {
    const periodoPedido = filtroPeriodo(query.dataInicial, query.dataFinal);

    // clientesAgrupado sem `take` (todos os clientes com pedido no
    // periodo, nao so o top N) - top vendedores precisa somar TODOS os
    // clientes de cada vendedor, nao so os que aparecem no top N de
    // clientes isolado (um vendedor com varios clientes medianos pode
    // superar um vendedor com um unico cliente grande).
    const [clientesAgrupado, topProdutosAgrupado] = await Promise.all([
      this.prisma.pedido.groupBy({
        by: ['clienteId'],
        where: { clienteId: { not: null }, dataHoraUltimaAlteracao: periodoPedido },
        _sum: { valorTotal: true },
      }),
      this.prisma.pedidoItem.groupBy({
        by: ['produtoId'],
        where: {
          produtoId: { not: null },
          pedido: { dataHoraUltimaAlteracao: periodoPedido },
        },
        _sum: { valorTotal: true },
        orderBy: { _sum: { valorTotal: 'desc' } },
        take: query.limite,
      }),
    ]);

    const topClientesAgrupado = [...clientesAgrupado]
      .sort((a, b) => Number(b._sum.valorTotal ?? 0) - Number(a._sum.valorTotal ?? 0))
      .slice(0, query.limite);

    const [clientes, produtos, vinculos] = await Promise.all([
      this.prisma.cliente.findMany({
        where: { id: { in: topClientesAgrupado.map((c) => c.clienteId as string) } },
        select: { id: true, razaoSocial: true, nomeFantasia: true },
      }),
      this.prisma.produto.findMany({
        where: { id: { in: topProdutosAgrupado.map((p) => p.produtoId as string) } },
        select: { id: true, nome: true, codigo: true },
      }),
      this.prisma.clienteVendedor.findMany({
        where: { clienteId: { in: clientesAgrupado.map((c) => c.clienteId as string) } },
        orderBy: { criadoEm: 'asc' },
        select: { clienteId: true, vendedorId: true },
      }),
    ]);
    const clientePorId = new Map(clientes.map((c) => [c.id, c]));
    const produtoPorId = new Map(produtos.map((p) => [p.id, p]));

    // ClienteVendedor e' N:N no schema, mas na pratica um cliente so
    // negocia com um vendedor (confirmado com o usuario) - o primeiro
    // vinculo (mais antigo) de cada cliente e' o vendedor responsavel, sem
    // inventar um criterio novo de "principal".
    const vendedorIdPorCliente = new Map<string, string>();
    for (const vinculo of vinculos) {
      if (!vendedorIdPorCliente.has(vinculo.clienteId)) {
        vendedorIdPorCliente.set(vinculo.clienteId, vinculo.vendedorId);
      }
    }

    const valorPorVendedor = new Map<string, number>();
    for (const linha of clientesAgrupado) {
      const vendedorId = vendedorIdPorCliente.get(linha.clienteId as string);
      if (!vendedorId) {
        continue;
      }
      const valorAtual = valorPorVendedor.get(vendedorId) ?? 0;
      valorPorVendedor.set(vendedorId, valorAtual + Number(linha._sum.valorTotal ?? 0));
    }

    const topVendedoresAgrupado = [...valorPorVendedor.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, query.limite);

    const vendedores = await this.prisma.vendedor.findMany({
      where: { id: { in: topVendedoresAgrupado.map(([id]) => id) } },
      select: { id: true, nome: true },
    });
    const vendedorPorId = new Map(vendedores.map((v) => [v.id, v]));

    return {
      periodo: { dataInicial: query.dataInicial ?? null, dataFinal: query.dataFinal ?? null },
      topClientes: topClientesAgrupado.map((linha) => {
        const cliente = clientePorId.get(linha.clienteId as string);
        return {
          id: linha.clienteId as string,
          nome: cliente?.razaoSocial ?? cliente?.nomeFantasia ?? '—',
          valorTotal: (linha._sum.valorTotal ?? 0).toString(),
        };
      }),
      topProdutos: topProdutosAgrupado.map((linha) => {
        const produto = produtoPorId.get(linha.produtoId as string);
        return {
          id: linha.produtoId as string,
          nome: produto?.nome ?? produto?.codigo ?? '—',
          valorTotal: (linha._sum.valorTotal ?? 0).toString(),
        };
      }),
      topVendedores: topVendedoresAgrupado.map(([id, valor]) => ({
        id,
        nome: vendedorPorId.get(id)?.nome ?? '—',
        valorTotal: valor.toString(),
      })),
    };
  }

  async obterNotasFiscais(query: PeriodoQueryDto): Promise<NotasFiscaisDashboardDto> {
    const where = { dataEmissao: filtroPeriodo(query.dataInicial, query.dataFinal) };

    const [somaFaturado, porStatus] = await this.prisma.$transaction([
      this.prisma.notaFiscal.aggregate({
        where,
        _sum: { valorTotalNotaFiscal: true },
      }),
      this.prisma.notaFiscal.groupBy({
        by: ['statusNfe'],
        where,
        orderBy: { statusNfe: 'asc' },
        _count: true,
      }),
    ]);

    return {
      periodo: { dataInicial: query.dataInicial ?? null, dataFinal: query.dataFinal ?? null },
      valorFaturado: (somaFaturado._sum.valorTotalNotaFiscal ?? 0).toString(),
      contagemPorStatus: porStatus.map((linha) => ({
        status: linha.statusNfe,
        quantidade: linha._count as unknown as number,
      })),
    };
  }

  // Join simples (nao e' previsao - ver OS-BACKEND-20 pra isso): saldo
  // baixo/zerado (<=limiar) E com pelo menos 1 PedidoItem de um pedido em
  // aberto (SITUACOES_EM_ABERTO) referenciando o produto. SaldoEstoque nao
  // tem FK pra Produto (casado por CODIGO, ver schema.prisma) - por isso
  // em 2 passos, nao da pra fazer num groupBy/include so.
  async obterEstoqueCritico(
    query: EstoqueCriticoQueryDto,
  ): Promise<EstoqueCriticoDashboardDto> {
    const saldosBaixos = await this.prisma.saldoEstoque.findMany({
      where: { quantidadeDisponivel: { lte: query.limiar } },
    });
    if (saldosBaixos.length === 0) {
      return { limiar: query.limiar, produtos: [] };
    }

    const produtos = await this.prisma.produto.findMany({
      where: { codigo: { in: saldosBaixos.map((s) => s.codigoProduto) } },
      select: { id: true, nome: true, codigo: true },
    });
    if (produtos.length === 0) {
      return { limiar: query.limiar, produtos: [] };
    }

    const pendentesPorProduto = await this.prisma.pedidoItem.groupBy({
      by: ['produtoId'],
      where: {
        produtoId: { in: produtos.map((p) => p.id) },
        pedido: { situacao: { in: SITUACOES_EM_ABERTO } },
      },
      orderBy: { produtoId: 'asc' },
      _count: true,
    });
    const pendentesPorId = new Map(
      pendentesPorProduto.map((linha) => [linha.produtoId, linha._count]),
    );
    const saldoPorCodigo = new Map(saldosBaixos.map((s) => [s.codigoProduto, s]));

    const produtosCriticos = produtos
      .filter((produto) => pendentesPorId.has(produto.id))
      .map((produto) => {
        const saldo = saldoPorCodigo.get(produto.codigo as string)!;
        return {
          produtoId: produto.id,
          nome: produto.nome,
          codigo: produto.codigo as string,
          quantidadeDisponivel: saldo.quantidadeDisponivel.toString(),
          quantidadePedidosPendentes: pendentesPorId.get(produto.id) ?? 0,
        };
      });

    return { limiar: query.limiar, produtos: produtosCriticos };
  }
}
