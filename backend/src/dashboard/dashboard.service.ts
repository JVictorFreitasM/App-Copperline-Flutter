import { Injectable } from '@nestjs/common';
import { StatusPedidoLocal, TipoSituacaoPedido } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paraPedidoResumoDto } from '../pedidos/dto/pedido-response.dto';
import { paraNotaFiscalDto } from '../notas-fiscais/dto/nota-fiscal-response.dto';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';
import {
  construirWhereNotaFiscalPorEscopo,
  construirWherePedidoPorEscopo,
} from '../vendedores/vendedor-escopo.service';
import { montarFunilPedidos } from './domain/montar-funil-pedidos';
import { filtroPeriodo } from './filtro-periodo';
import type { EstoqueCriticoQueryDto, EstoqueCriticoDashboardDto } from './dto/estoque-critico-dashboard.dto';
import type { FunilPedidosDashboardDto } from './dto/funil-pedidos-dashboard.dto';
import type { NotasFiscaisDashboardDto } from './dto/notas-fiscais-dashboard.dto';
import type { RankingDashboardDto, RankingQueryDto } from './dto/ranking-dashboard.dto';
import type { MapaCalorVendasDto } from './dto/mapa-calor-vendas.dto';
import type { PeriodoQueryDto } from './dto/periodo-query.dto';
import type { ResumoDashboardDto } from './dto/resumo-dashboard.dto';
import type { VendasDashboardDto } from './dto/vendas-dashboard.dto';
import type {
  ComparativoMensalDashboardDto,
  ComparativoMensalQueryDto,
} from './dto/comparativo-mensal-dashboard.dto';
import type { VendasPorEstadoDashboardDto } from './dto/vendas-por-estado-dashboard.dto';
import type { VendasVsFaturadoDashboardDto } from './dto/vendas-vs-faturado-dashboard.dto';
import type { KpisDashboardDto } from './dto/kpis-dashboard.dto';

const PERIODO_VALOR_FATURADO_DIAS = 30;
const QUANTIDADE_RECENTES = 5;
// Epico 1.1 - "cliente sem pedido ha mais de X dias" (card "+30 dias sem
// pedido"). Constante propria (mesmo valor de PERIODO_VALOR_FATURADO_DIAS
// hoje, mas semantica diferente - nao reaproveitar o mesmo nome pra nao
// acoplar dois conceitos que podem divergir no futuro).
const DIAS_SEM_PEDIDO_RECENTE = 30;

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
      pedidosRecentes: pedidosRecentes.map((pedido) => paraPedidoResumoDto(pedido)),
      notasFiscaisRecentes: notasFiscaisRecentes.map(paraNotaFiscalDto),
    };
  }

  async obterVendas(
    query: PeriodoQueryDto,
    escopo: EscopoClientes,
  ): Promise<VendasDashboardDto> {
    const wherePedido = construirWherePedidoPorEscopo(escopo);
    if (wherePedido === null) {
      return {
        periodo: { dataInicial: query.dataInicial ?? null, dataFinal: query.dataFinal ?? null },
        totalPedidos: 0,
        valorTotal: '0',
        ticketMedio: '0',
        contagemPorSituacao: [],
      };
    }

    const where = {
      ...wherePedido,
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
  async obterFunilPedidos(
    query: PeriodoQueryDto,
    escopo: EscopoClientes,
  ): Promise<FunilPedidosDashboardDto> {
    const wherePedido = construirWherePedidoPorEscopo(escopo);
    if (wherePedido === null) {
      return {
        periodo: { dataInicial: query.dataInicial ?? null, dataFinal: query.dataFinal ?? null },
        ...montarFunilPedidos([]),
      };
    }

    const where = {
      ...wherePedido,
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

  async obterRanking(
    query: RankingQueryDto,
    escopo: EscopoClientes,
  ): Promise<RankingDashboardDto> {
    const periodoPedido = filtroPeriodo(query.dataInicial, query.dataFinal);
    const wherePedido = construirWherePedidoPorEscopo(escopo);
    if (wherePedido === null) {
      return {
        periodo: { dataInicial: query.dataInicial ?? null, dataFinal: query.dataFinal ?? null },
        topClientes: [],
        topProdutos: [],
        topVendedores: [],
      };
    }

    // clientesAgrupado sem `take` (todos os clientes com pedido no
    // periodo, nao so o top N) - top vendedores precisa somar TODOS os
    // clientes de cada vendedor, nao so os que aparecem no top N de
    // clientes isolado (um vendedor com varios clientes medianos pode
    // superar um vendedor com um unico cliente grande).
    const [clientesAgrupado, topProdutosAgrupado] = await Promise.all([
      this.prisma.pedido.groupBy({
        by: ['clienteId'],
        where: { ...wherePedido, clienteId: { not: null }, dataHoraUltimaAlteracao: periodoPedido },
        _sum: { valorTotal: true },
      }),
      this.prisma.pedidoItem.groupBy({
        by: ['produtoId'],
        where: {
          produtoId: { not: null },
          pedido: { ...wherePedido, dataHoraUltimaAlteracao: periodoPedido },
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

  async obterNotasFiscais(
    query: PeriodoQueryDto,
    escopo: EscopoClientes,
  ): Promise<NotasFiscaisDashboardDto> {
    const whereNotaFiscal = construirWhereNotaFiscalPorEscopo(escopo);
    if (whereNotaFiscal === null) {
      return {
        periodo: { dataInicial: query.dataInicial ?? null, dataFinal: query.dataFinal ?? null },
        valorFaturado: '0',
        contagemPorStatus: [],
      };
    }

    const where = {
      ...whereNotaFiscal,
      dataEmissao: filtroPeriodo(query.dataInicial, query.dataFinal),
    };

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

  // OS-WEB-39 - so' clientes com pin de localizacao definido
  // (Cliente.localizacaoLat/Lng, OS-MOBILE-21) tem coordenada real; o
  // endereco cadastral do WK Radar (`enderecos`) e' so texto, sem
  // geocodificacao (ver dto/mapa-calor-vendas.dto.ts). totalClientesNoPeriodo
  // deixa explicito no proprio retorno que o mapa cobre so uma fatia.
  async obterMapaCalorVendas(query: PeriodoQueryDto): Promise<MapaCalorVendasDto> {
    const periodoPedido = filtroPeriodo(query.dataInicial, query.dataFinal);

    const clientesAgrupado = await this.prisma.pedido.groupBy({
      by: ['clienteId'],
      where: { clienteId: { not: null }, dataHoraUltimaAlteracao: periodoPedido },
      _sum: { valorTotal: true },
    });
    if (clientesAgrupado.length === 0) {
      return { pontos: [], totalClientesNoPeriodo: 0 };
    }

    const clientesComPin = await this.prisma.cliente.findMany({
      where: {
        id: { in: clientesAgrupado.map((c) => c.clienteId as string) },
        localizacaoLat: { not: null },
        localizacaoLng: { not: null },
      },
      select: { id: true, razaoSocial: true, nomeFantasia: true, localizacaoLat: true, localizacaoLng: true },
    });
    const clientePorId = new Map(clientesComPin.map((c) => [c.id, c]));

    const pontos: MapaCalorVendasDto['pontos'] = [];
    for (const linha of clientesAgrupado) {
      const cliente = clientePorId.get(linha.clienteId as string);
      if (!cliente) continue;
      pontos.push({
        clienteId: cliente.id,
        nome: cliente.nomeFantasia ?? cliente.razaoSocial,
        latitude: cliente.localizacaoLat!.toNumber(),
        longitude: cliente.localizacaoLng!.toNumber(),
        valorTotal: Number(linha._sum.valorTotal ?? 0),
      });
    }

    return { pontos, totalClientesNoPeriodo: clientesAgrupado.length };
  }

  // Epico 2 (OS-dashboard-configuracoes-notificacoes-auditoria.md) -
  // "vendas" aqui reaproveita a MESMA definicao ja usada em obterResumo
  // (valorFaturadoRecente: SITUACOES_FATURADAS) pra nao inventar um segundo
  // criterio de "venda aprovada" dentro do mesmo dashboard. Agregacao por
  // mes feita em JS (Prisma nao tem date_trunc no groupBy) - mesmo criterio
  // ja usado em obterRanking pra somas que o Prisma nao agrupa sozinho;
  // volume de pedidos/ano desta empresa nao justifica SQL cru ainda.
  async obterComparativoMensal(
    query: ComparativoMensalQueryDto,
    escopo: EscopoClientes,
  ): Promise<ComparativoMensalDashboardDto> {
    const anoAtual = query.ano ?? new Date().getFullYear();
    const anoAnterior = anoAtual - 1;
    const wherePedido = construirWherePedidoPorEscopo(escopo);
    if (wherePedido === null) {
      const meses = Array.from({ length: 12 }, (_, indiceMes) => ({
        mes: indiceMes + 1,
        valorAnoAtual: '0',
        valorAnoAnterior: '0',
      }));
      return { anoAtual, anoAnterior, meses };
    }

    const pedidos = await this.prisma.pedido.findMany({
      where: {
        ...wherePedido,
        situacao: { in: SITUACOES_FATURADAS },
        dataHoraUltimaAlteracao: {
          gte: new Date(Date.UTC(anoAnterior, 0, 1)),
          lt: new Date(Date.UTC(anoAtual + 1, 0, 1)),
        },
      },
      select: { dataHoraUltimaAlteracao: true, valorTotal: true },
    });

    const somaPorAnoMes = new Map<string, number>();
    for (const pedido of pedidos) {
      const data = pedido.dataHoraUltimaAlteracao!;
      const chave = `${data.getUTCFullYear()}-${data.getUTCMonth()}`;
      somaPorAnoMes.set(
        chave,
        (somaPorAnoMes.get(chave) ?? 0) + Number(pedido.valorTotal ?? 0),
      );
    }

    const meses = Array.from({ length: 12 }, (_, indiceMes) => ({
      mes: indiceMes + 1,
      valorAnoAtual: (somaPorAnoMes.get(`${anoAtual}-${indiceMes}`) ?? 0).toString(),
      valorAnoAnterior: (somaPorAnoMes.get(`${anoAnterior}-${indiceMes}`) ?? 0).toString(),
    }));

    return { anoAtual, anoAnterior, meses };
  }

  // Epico 1.2 - Pedido.ufEntrega so' vem preenchido pra ~7% dos pedidos
  // (ver comentario no schema.prisma) - quantidadePedidosSemUf exposto
  // explicitamente pra tela nunca fingir cobertura de 100%.
  async obterVendasPorEstado(
    query: PeriodoQueryDto,
    escopo: EscopoClientes,
  ): Promise<VendasPorEstadoDashboardDto> {
    const periodo = filtroPeriodo(query.dataInicial, query.dataFinal);
    const wherePedido = construirWherePedidoPorEscopo(escopo);
    if (wherePedido === null) {
      return {
        periodo: { dataInicial: query.dataInicial ?? null, dataFinal: query.dataFinal ?? null },
        estados: [],
        quantidadePedidosSemUf: 0,
      };
    }

    const [porEstado, semUf] = await this.prisma.$transaction([
      this.prisma.pedido.groupBy({
        by: ['ufEntrega'],
        where: { ...wherePedido, ufEntrega: { not: null }, dataHoraUltimaAlteracao: periodo },
        _sum: { valorTotal: true },
        _count: true,
        orderBy: { _sum: { valorTotal: 'desc' } },
      }),
      this.prisma.pedido.count({
        where: { ...wherePedido, ufEntrega: null, dataHoraUltimaAlteracao: periodo },
      }),
    ]);

    return {
      periodo: { dataInicial: query.dataInicial ?? null, dataFinal: query.dataFinal ?? null },
      estados: porEstado.map((linha) => ({
        uf: linha.ufEntrega as string,
        valorTotal: (linha._sum?.valorTotal ?? 0).toString(),
        quantidadePedidos: linha._count as unknown as number,
      })),
      quantidadePedidosSemUf: semUf,
    };
  }

  // Epico 1.2 - "Vendas x Faturado": valorVendido e' o TOTAL de pedidos no
  // periodo (sem filtro de situacao, ao contrario de obterComparativoMensal
  // acima - aqui o objetivo e' justamente mostrar o GAP entre o que foi
  // vendido e o que ja foi faturado de verdade, ver NotaFiscal). Agregacao
  // por mes em JS, mesmo criterio de obterComparativoMensal.
  async obterVendasVsFaturado(
    query: PeriodoQueryDto,
    escopo: EscopoClientes,
  ): Promise<VendasVsFaturadoDashboardDto> {
    const periodo = filtroPeriodo(query.dataInicial, query.dataFinal);
    const wherePedido = construirWherePedidoPorEscopo(escopo);
    const whereNotaFiscal = construirWhereNotaFiscalPorEscopo(escopo);
    if (wherePedido === null || whereNotaFiscal === null) {
      return { periodo: { dataInicial: query.dataInicial ?? null, dataFinal: query.dataFinal ?? null }, meses: [] };
    }

    const [pedidos, notas] = await Promise.all([
      this.prisma.pedido.findMany({
        where: { ...wherePedido, dataHoraUltimaAlteracao: periodo },
        select: { dataHoraUltimaAlteracao: true, valorTotal: true },
      }),
      this.prisma.notaFiscal.findMany({
        where: { ...whereNotaFiscal, dataEmissao: periodo },
        select: { dataEmissao: true, valorTotalNotaFiscal: true },
      }),
    ]);

    const vendidoPorMes = new Map<string, number>();
    for (const pedido of pedidos) {
      if (!pedido.dataHoraUltimaAlteracao) continue;
      const chave = chaveAnoMes(pedido.dataHoraUltimaAlteracao);
      vendidoPorMes.set(chave, (vendidoPorMes.get(chave) ?? 0) + Number(pedido.valorTotal ?? 0));
    }

    const faturadoPorMes = new Map<string, number>();
    for (const nota of notas) {
      if (!nota.dataEmissao) continue;
      const chave = chaveAnoMes(nota.dataEmissao);
      faturadoPorMes.set(
        chave,
        (faturadoPorMes.get(chave) ?? 0) + Number(nota.valorTotalNotaFiscal ?? 0),
      );
    }

    const chaves = new Set([...vendidoPorMes.keys(), ...faturadoPorMes.keys()]);
    const meses = [...chaves].sort().map((chave) => ({
      mes: chave,
      valorVendido: (vendidoPorMes.get(chave) ?? 0).toString(),
      valorFaturado: (faturadoPorMes.get(chave) ?? 0).toString(),
    }));

    return {
      periodo: { dataInicial: query.dataInicial ?? null, dataFinal: query.dataFinal ?? null },
      meses,
    };
  }

  // Epico 1.1 (OS-dashboard-configuracoes-notificacoes-auditoria.md) - 3
  // cards de KPI do topo do painel. Definicoes confirmadas com o usuario
  // (a OS original deixava isso em aberto, ver ressalva no proprio
  // documento):
  // - "Orcamentos Abertos" = Pedido.statusLocal ORCAMENTO (rascunho local,
  //   Epico 4 - ver criar-pedido.service.ts), nao o bucket NAO_INTEGRADO
  //   nem o model Oportunidade (cogitados na OS original antes de
  //   ORCAMENTO existir como status real).
  // - "Pedido aprovado" (usado no ticket medio e no calculo de cliente
  //   sem pedido recente) = SITUACOES_FATURADAS, MESMA definicao ja usada
  //   em obterResumo/obterComparativoMensal - sem inventar um terceiro
  //   criterio de "aprovado" dentro do mesmo dashboard.
  // - "Valor em potencial de vendas" = ticket medio GERAL (todos os
  //   pedidos aprovados) x quantidade de clientes sem pedido recente -
  //   nao a soma do ticket medio individual de cada cliente (mais caro de
  //   calcular, descartado pelo usuario).
  async obterKpis(): Promise<KpisDashboardDto> {
    const cortePedidoRecente = new Date();
    cortePedidoRecente.setDate(cortePedidoRecente.getDate() - DIAS_SEM_PEDIDO_RECENTE);

    const [orcamentos, agregadoAprovados, ultimoPedidoAprovadoPorCliente] = await Promise.all([
      this.prisma.pedido.aggregate({
        where: { statusLocal: StatusPedidoLocal.ORCAMENTO },
        _count: true,
        _sum: { valorTotal: true },
      }),
      this.prisma.pedido.aggregate({
        where: { situacao: { in: SITUACOES_FATURADAS } },
        _count: true,
        _avg: { valorTotal: true },
      }),
      this.prisma.pedido.groupBy({
        by: ['clienteId'],
        where: { situacao: { in: SITUACOES_FATURADAS }, clienteId: { not: null } },
        _max: { dataHoraUltimaAlteracao: true },
      }),
    ]);

    const clienteIdsSemPedidoRecente = ultimoPedidoAprovadoPorCliente
      .filter(
        (linha) =>
          linha._max.dataHoraUltimaAlteracao !== null &&
          linha._max.dataHoraUltimaAlteracao < cortePedidoRecente,
      )
      .map((linha) => linha.clienteId as string);

    // So conta cliente ainda ativo (mesmo criterio de clientesAtivos em
    // obterResumo) - cliente inativado nao entra na meta de reativacao.
    const quantidadeClientesSemPedidoRecente =
      clienteIdsSemPedidoRecente.length === 0
        ? 0
        : await this.prisma.cliente.count({
            where: { id: { in: clienteIdsSemPedidoRecente }, inativo: false },
          });

    const ticketMedioGeral = Number(agregadoAprovados._avg.valorTotal ?? 0);

    return {
      orcamentosAbertos: {
        quantidade: orcamentos._count,
        valorTotal: (orcamentos._sum.valorTotal ?? 0).toString(),
      },
      clientesSemPedidoRecente: {
        quantidade: quantidadeClientesSemPedidoRecente,
        valorPotencial: (ticketMedioGeral * quantidadeClientesSemPedidoRecente).toString(),
        diasSemPedido: DIAS_SEM_PEDIDO_RECENTE,
      },
      ticketMedioVendas: {
        valor: ticketMedioGeral.toString(),
        quantidadePedidos: agregadoAprovados._count,
      },
    };
  }
}

function chaveAnoMes(data: Date): string {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`;
}
