import { DashboardService } from './dashboard.service';

function prismaFake(overrides: {
  clientesAtivos?: number;
  produtosAtivos?: number;
  pedidosEmAberto?: number;
  somaFaturado?: unknown;
  pedidosRecentes?: unknown[];
  notasFiscaisRecentes?: unknown[];
}) {
  return {
    cliente: {
      count: jest.fn().mockResolvedValue(overrides.clientesAtivos ?? 0),
    },
    produto: {
      count: jest.fn().mockResolvedValue(overrides.produtosAtivos ?? 0),
    },
    pedido: {
      count: jest.fn().mockResolvedValue(overrides.pedidosEmAberto ?? 0),
      aggregate: jest.fn().mockResolvedValue({
        _sum: { valorTotal: overrides.somaFaturado ?? null },
      }),
      findMany: jest.fn().mockResolvedValue(overrides.pedidosRecentes ?? []),
    },
    notaFiscal: {
      findMany: jest
        .fn()
        .mockResolvedValue(overrides.notasFiscaisRecentes ?? []),
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
