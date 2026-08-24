import { SaldoEstoqueSyncStrategy } from './saldo-estoque.sync';

function estoqueSvcClientFake(
  itens: { codigoProduto: string; quantidadeDisponivel: string }[],
) {
  return { buscarSaldoProduto: jest.fn().mockResolvedValue(itens) };
}

function decimalFake(valor: number) {
  return { toNumber: () => valor };
}

function prismaFake(overrides: {
  saldoExistente?: { quantidadeDisponivel: ReturnType<typeof decimalFake> } | null;
  produtoExistente?: { id: string } | null;
} = {}) {
  const tx = {
    saldoEstoque: {
      findUnique: jest.fn().mockResolvedValue(overrides.saldoExistente ?? null),
      upsert: jest.fn().mockImplementation(({ create }) => ({
        ...create,
        quantidadeDisponivel: decimalFake(Number(create.quantidadeDisponivel)),
      })),
    },
    produto: {
      findFirst: jest.fn().mockResolvedValue(overrides.produtoExistente ?? null),
    },
    eventoNotificacao: {
      create: jest.fn().mockResolvedValue(undefined),
    },
  };
  return {
    tx,
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
  };
}

const JANELA = { desde: new Date('2026-01-01T00:00:00.000Z'), ate: new Date() };

describe('SaldoEstoqueSyncStrategy', () => {
  it('fetch() retorna todos os itens de uma unica chamada (sem paginacao/filtro incremental)', async () => {
    const client = estoqueSvcClientFake([
      { codigoProduto: '1', quantidadeDisponivel: '10' },
      { codigoProduto: '2', quantidadeDisponivel: '20' },
    ]);
    const strategy = new SaldoEstoqueSyncStrategy(client as never, prismaFake() as never);

    const resultado = await strategy.fetch(JANELA);

    expect(resultado.registros).toHaveLength(2);
    expect(resultado.avisos).toEqual([]);
    expect(client.buscarSaldoProduto).toHaveBeenCalledTimes(1);
    expect(client.buscarSaldoProduto).toHaveBeenCalledWith();
  });

  it('propaga erro do client sem engolir', async () => {
    const client = { buscarSaldoProduto: jest.fn().mockRejectedValue(new Error('timeout')) };
    const strategy = new SaldoEstoqueSyncStrategy(client as never, prismaFake() as never);

    await expect(strategy.fetch(JANELA)).rejects.toThrow('timeout');
  });

  it('map() converte QuantidadeDisponivel de formato BR pra decimal', () => {
    const strategy = new SaldoEstoqueSyncStrategy({} as never, prismaFake() as never);

    const mapeado = strategy.map({
      codigoProduto: '50010',
      quantidadeDisponivel: '4.954,4349',
    });

    expect(mapeado).toEqual({
      codigoProduto: '50010',
      quantidadeDisponivel: '4954.4349',
    });
  });

  it('upsert() grava por codigoProduto', async () => {
    const prisma = prismaFake();
    const strategy = new SaldoEstoqueSyncStrategy({} as never, prisma as never);

    await strategy.upsert({ codigoProduto: '50010', quantidadeDisponivel: '14.583' });

    expect(prisma.tx.saldoEstoque.upsert).toHaveBeenCalledWith({
      where: { codigoProduto: '50010' },
      create: { codigoProduto: '50010', quantidadeDisponivel: '14.583' },
      update: { quantidadeDisponivel: '14.583' },
    });
  });

  describe('alerta de reabastecimento (OS-BACKEND-19)', () => {
    it('registra evento quando o saldo sai de zero pra positivo E ha Produto sincronizado', async () => {
      const prisma = prismaFake({
        saldoExistente: { quantidadeDisponivel: decimalFake(0) },
        produtoExistente: { id: 'produto-1' },
      });
      const strategy = new SaldoEstoqueSyncStrategy({} as never, prisma as never);

      await strategy.upsert({ codigoProduto: '50010', quantidadeDisponivel: '10' });

      expect(prisma.tx.eventoNotificacao.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'PRODUTO_REABASTECIDO',
            referenciaId: 'produto-1',
          }),
        }),
      );
    });

    it('nao registra evento se o produto ainda nao foi sincronizado localmente', async () => {
      const prisma = prismaFake({
        saldoExistente: { quantidadeDisponivel: decimalFake(0) },
        produtoExistente: null,
      });
      const strategy = new SaldoEstoqueSyncStrategy({} as never, prisma as never);

      await strategy.upsert({ codigoProduto: '50010', quantidadeDisponivel: '10' });

      expect(prisma.tx.eventoNotificacao.create).not.toHaveBeenCalled();
    });

    it('nao registra evento se o saldo ja era positivo antes (nao "saiu" de zero)', async () => {
      const prisma = prismaFake({
        saldoExistente: { quantidadeDisponivel: decimalFake(5) },
        produtoExistente: { id: 'produto-1' },
      });
      const strategy = new SaldoEstoqueSyncStrategy({} as never, prisma as never);

      await strategy.upsert({ codigoProduto: '50010', quantidadeDisponivel: '10' });

      expect(prisma.tx.eventoNotificacao.create).not.toHaveBeenCalled();
    });

    it('nao registra evento na primeira sincronizacao (sem saldo anterior)', async () => {
      const prisma = prismaFake({ saldoExistente: null, produtoExistente: { id: 'produto-1' } });
      const strategy = new SaldoEstoqueSyncStrategy({} as never, prisma as never);

      await strategy.upsert({ codigoProduto: '50010', quantidadeDisponivel: '10' });

      expect(prisma.tx.eventoNotificacao.create).not.toHaveBeenCalled();
    });
  });
});
