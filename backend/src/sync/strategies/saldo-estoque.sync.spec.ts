import { SaldoEstoqueSyncStrategy } from './saldo-estoque.sync';

function estoqueSvcClientFake(
  itens: { codigoProduto: string; quantidadeDisponivel: string }[],
) {
  return { buscarSaldoProduto: jest.fn().mockResolvedValue(itens) };
}

function prismaFake() {
  return { saldoEstoque: { upsert: jest.fn().mockResolvedValue(undefined) } };
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

    expect(prisma.saldoEstoque.upsert).toHaveBeenCalledWith({
      where: { codigoProduto: '50010' },
      create: { codigoProduto: '50010', quantidadeDisponivel: '14.583' },
      update: { quantidadeDisponivel: '14.583' },
    });
  });
});
