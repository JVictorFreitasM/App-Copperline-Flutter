import { DashboardService } from './dashboard.service';

function prismaFake(overrides: {
  clientesAtivos?: number;
  produtosAtivos?: number;
  pedidosEmAberto?: number;
  somaFaturado?: unknown;
  pedidosRecentes?: unknown[];
  notasFiscaisRecentes?: unknown[];
  pedidoAggregate?: unknown;
  pedidoGroupBy?: unknown[];
  pedidoItemGroupBy?: unknown[];
  notaFiscalAggregate?: unknown;
  notaFiscalGroupBy?: unknown[];
  clientes?: unknown[];
  produtos?: unknown[];
  saldosEstoque?: unknown[];
  vinculosClienteVendedor?: unknown[];
  vendedores?: unknown[];
}) {
  return {
    cliente: {
      count: jest.fn().mockResolvedValue(overrides.clientesAtivos ?? 0),
      findMany: jest.fn().mockResolvedValue(overrides.clientes ?? []),
    },
    produto: {
      count: jest.fn().mockResolvedValue(overrides.produtosAtivos ?? 0),
      findMany: jest.fn().mockResolvedValue(overrides.produtos ?? []),
    },
    clienteVendedor: {
      findMany: jest.fn().mockResolvedValue(overrides.vinculosClienteVendedor ?? []),
    },
    vendedor: {
      findMany: jest.fn().mockResolvedValue(overrides.vendedores ?? []),
    },
    pedido: {
      count: jest.fn().mockResolvedValue(overrides.pedidosEmAberto ?? 0),
      aggregate: jest.fn().mockResolvedValue(
        overrides.pedidoAggregate ?? { _count: 0, _sum: { valorTotal: overrides.somaFaturado ?? null } },
      ),
      groupBy: jest.fn().mockResolvedValue(overrides.pedidoGroupBy ?? []),
      findMany: jest.fn().mockResolvedValue(overrides.pedidosRecentes ?? []),
    },
    pedidoItem: {
      groupBy: jest.fn().mockResolvedValue(overrides.pedidoItemGroupBy ?? []),
    },
    notaFiscal: {
      aggregate: jest.fn().mockResolvedValue(
        overrides.notaFiscalAggregate ?? { _sum: { valorTotalNotaFiscal: null } },
      ),
      groupBy: jest.fn().mockResolvedValue(overrides.notaFiscalGroupBy ?? []),
      findMany: jest
        .fn()
        .mockResolvedValue(overrides.notasFiscaisRecentes ?? []),
    },
    saldoEstoque: {
      findMany: jest.fn().mockResolvedValue(overrides.saldosEstoque ?? []),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

describe('DashboardService.obterResumo', () => {
  it('agrega contagens e soma de valor faturado nos ultimos 30 dias', async () => {
    const prisma = prismaFake({
      clientesAtivos: 42,
      produtosAtivos: 17,
      pedidosEmAberto: 5,
      somaFaturado: { toString: () => '1500.50' },
    });
    const service = new DashboardService(prisma as never);

    const resumo = await service.obterResumo();

    expect(resumo.clientesAtivos).toBe(42);
    expect(resumo.produtosAtivos).toBe(17);
    expect(resumo.pedidosEmAberto).toBe(5);
    expect(resumo.valorFaturadoRecente).toBe('1500.50');
    expect(resumo.periodoValorFaturadoDias).toBe(30);
  });

  it('devolve "0" como valor faturado quando nao ha nenhum pedido faturado no periodo', async () => {
    const prisma = prismaFake({});
    const service = new DashboardService(prisma as never);

    const resumo = await service.obterResumo();

    expect(resumo.valorFaturadoRecente).toBe('0');
  });

  it('conta pedidos em aberto so com as situacoes nao-finalizadas', async () => {
    const prisma = prismaFake({});
    const service = new DashboardService(prisma as never);

    await service.obterResumo();

    expect(prisma.pedido.count).toHaveBeenCalledWith({
      where: {
        situacao: {
          in: [
            'EM_ANALISE',
            'BLOQUEADO',
            'PENDENTE',
            'PARCIALMENTE_FATURADO',
            'PARCIALMENTE_ATENDIDO',
          ],
        },
      },
    });
  });
});

describe('DashboardService.obterVendas', () => {
  it('calcula ticketMedio dividindo valorTotal por totalPedidos', async () => {
    const prisma = prismaFake({
      pedidoAggregate: { _count: 4, _sum: { valorTotal: { toString: () => '1000' } } },
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterVendas({});

    expect(resultado.totalPedidos).toBe(4);
    expect(resultado.valorTotal).toBe('1000');
    expect(resultado.ticketMedio).toBe('250.00');
  });

  it('ticketMedio fica "0" quando nao ha pedidos no periodo (nunca divide por zero)', async () => {
    const prisma = prismaFake({ pedidoAggregate: { _count: 0, _sum: { valorTotal: null } } });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterVendas({});

    expect(resultado.ticketMedio).toBe('0');
  });

  it('aplica o filtro de periodo em dataHoraUltimaAlteracao', async () => {
    const prisma = prismaFake({});
    const service = new DashboardService(prisma as never);

    await service.obterVendas({ dataInicial: '2026-01-01', dataFinal: '2026-01-31' });

    expect(prisma.pedido.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dataHoraUltimaAlteracao: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-01-31T23:59:59.999Z'),
          },
        },
      }),
    );
  });
});

describe('DashboardService.obterRanking', () => {
  // OS-WEB-29 - criterio de aceite: periodo sem nenhum pedido/pedidoItem
  // (groupBy vazio) nao lanca excecao, so retorna listas vazias.
  it('retorna topClientes/topProdutos vazios quando o periodo nao tem nenhum registro', async () => {
    const prisma = prismaFake({ pedidoGroupBy: [], pedidoItemGroupBy: [] });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterRanking({
      dataInicial: '1900-01-01',
      dataFinal: '1900-01-02',
      limite: 10,
    });

    expect(resultado.topClientes).toEqual([]);
    expect(resultado.topProdutos).toEqual([]);
    expect(resultado.topVendedores).toEqual([]);
  });

  it('resolve nome do cliente/produto pros ids agrupados', async () => {
    const prisma = prismaFake({
      pedidoGroupBy: [{ clienteId: 'c1', _sum: { valorTotal: { toString: () => '500' } } }],
      pedidoItemGroupBy: [{ produtoId: 'p1', _sum: { valorTotal: { toString: () => '300' } } }],
      clientes: [{ id: 'c1', razaoSocial: 'Cliente Um', nomeFantasia: null }],
      produtos: [{ id: 'p1', nome: 'Produto Um', codigo: 'COD-1' }],
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterRanking({ limite: 10 });

    expect(resultado.topClientes).toEqual([{ id: 'c1', nome: 'Cliente Um', valorTotal: '500' }]);
    expect(resultado.topProdutos).toEqual([{ id: 'p1', nome: 'Produto Um', valorTotal: '300' }]);
  });

  it('soma o valor de todos os clientes vinculados a um vendedor pro ranking de top vendedores', async () => {
    const prisma = prismaFake({
      pedidoGroupBy: [
        { clienteId: 'c1', _sum: { valorTotal: { toString: () => '500' } } },
        { clienteId: 'c2', _sum: { valorTotal: { toString: () => '300' } } },
      ],
      clientes: [
        { id: 'c1', razaoSocial: 'Cliente Um', nomeFantasia: null },
        { id: 'c2', razaoSocial: 'Cliente Dois', nomeFantasia: null },
      ],
      vinculosClienteVendedor: [
        { clienteId: 'c1', vendedorId: 'v1' },
        { clienteId: 'c2', vendedorId: 'v1' },
      ],
      vendedores: [{ id: 'v1', nome: 'Vendedor Um' }],
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterRanking({ limite: 10 });

    expect(resultado.topVendedores).toEqual([{ id: 'v1', nome: 'Vendedor Um', valorTotal: '800' }]);
  });

  it('cliente sem vinculo de vendedor nao contribui pro ranking de vendedores (sem inventar atribuicao)', async () => {
    const prisma = prismaFake({
      pedidoGroupBy: [{ clienteId: 'c1', _sum: { valorTotal: { toString: () => '500' } } }],
      clientes: [{ id: 'c1', razaoSocial: 'Cliente Um', nomeFantasia: null }],
      vinculosClienteVendedor: [],
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterRanking({ limite: 10 });

    expect(resultado.topVendedores).toEqual([]);
  });

  it('usa o primeiro vinculo (mais antigo) quando o schema permite mais de um vendedor por cliente', async () => {
    const prisma = prismaFake({
      pedidoGroupBy: [{ clienteId: 'c1', _sum: { valorTotal: { toString: () => '500' } } }],
      clientes: [{ id: 'c1', razaoSocial: 'Cliente Um', nomeFantasia: null }],
      // findMany ja ordenado por criadoEm asc (mesmo comportamento do
      // orderBy passado ao Prisma real) - v1 e' o mais antigo.
      vinculosClienteVendedor: [
        { clienteId: 'c1', vendedorId: 'v1' },
        { clienteId: 'c1', vendedorId: 'v2' },
      ],
      vendedores: [{ id: 'v1', nome: 'Vendedor Antigo' }],
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterRanking({ limite: 10 });

    expect(resultado.topVendedores).toEqual([{ id: 'v1', nome: 'Vendedor Antigo', valorTotal: '500' }]);
  });
});

describe('DashboardService.obterNotasFiscais', () => {
  // OS-WEB-29 - mesmo criterio de obterRanking: periodo sem nenhuma nota
  // fiscal nao lanca excecao, so "0"/lista vazia.
  it('valorFaturado fica "0" e contagemPorStatus vazia quando nao ha nota fiscal no periodo', async () => {
    const prisma = prismaFake({
      notaFiscalAggregate: { _sum: { valorTotalNotaFiscal: null } },
      notaFiscalGroupBy: [],
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterNotasFiscais({
      dataInicial: '1900-01-01',
      dataFinal: '1900-01-02',
    });

    expect(resultado.valorFaturado).toBe('0');
    expect(resultado.contagemPorStatus).toEqual([]);
  });

  it('soma valorTotalNotaFiscal e agrupa por statusNfe no periodo', async () => {
    const prisma = prismaFake({
      notaFiscalAggregate: { _sum: { valorTotalNotaFiscal: { toString: () => '2500' } } },
      notaFiscalGroupBy: [{ statusNfe: 'AUTORIZADA', _count: 3 }],
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterNotasFiscais({});

    expect(resultado.valorFaturado).toBe('2500');
    expect(resultado.contagemPorStatus).toEqual([{ status: 'AUTORIZADA', quantidade: 3 }]);
  });
});

describe('DashboardService.obterEstoqueCritico', () => {
  it('so lista produto com saldo baixo E pelo menos 1 pedido pendente referenciando ele', async () => {
    const prisma = prismaFake({
      saldosEstoque: [
        { codigoProduto: 'COD-BAIXO-SEM-PEDIDO', quantidadeDisponivel: { toString: () => '2' } },
        { codigoProduto: 'COD-BAIXO-COM-PEDIDO', quantidadeDisponivel: { toString: () => '0' } },
      ],
      produtos: [
        { id: 'p-sem-pedido', nome: 'Sem pedido', codigo: 'COD-BAIXO-SEM-PEDIDO' },
        { id: 'p-com-pedido', nome: 'Com pedido', codigo: 'COD-BAIXO-COM-PEDIDO' },
      ],
      pedidoItemGroupBy: [{ produtoId: 'p-com-pedido', _count: 2 }],
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterEstoqueCritico({ limiar: 10 });

    expect(resultado.produtos).toHaveLength(1);
    expect(resultado.produtos[0]).toEqual({
      produtoId: 'p-com-pedido',
      nome: 'Com pedido',
      codigo: 'COD-BAIXO-COM-PEDIDO',
      quantidadeDisponivel: '0',
      quantidadePedidosPendentes: 2,
    });
  });

  it('filtra pedido pendente so entre as situacoes em aberto', async () => {
    const prisma = prismaFake({
      saldosEstoque: [{ codigoProduto: 'COD-1', quantidadeDisponivel: { toString: () => '1' } }],
      produtos: [{ id: 'p1', nome: 'Produto 1', codigo: 'COD-1' }],
      pedidoItemGroupBy: [],
    });
    const service = new DashboardService(prisma as never);

    await service.obterEstoqueCritico({ limiar: 10 });

    expect(prisma.pedidoItem.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          pedido: {
            situacao: {
              in: [
                'EM_ANALISE',
                'BLOQUEADO',
                'PENDENTE',
                'PARCIALMENTE_FATURADO',
                'PARCIALMENTE_ATENDIDO',
              ],
            },
          },
        }),
      }),
    );
  });

  it('retorna lista vazia quando nao ha nenhum saldo abaixo do limiar', async () => {
    const prisma = prismaFake({ saldosEstoque: [] });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterEstoqueCritico({ limiar: 10 });

    expect(resultado.produtos).toEqual([]);
  });
});
