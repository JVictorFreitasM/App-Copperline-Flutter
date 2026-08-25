import { ConfiguracaoDescontoService } from './configuracao-desconto.service';

function decimalFake(valor: number) {
  return { toNumber: () => valor, toString: () => String(valor) };
}

function prismaFake(linhaExistente: Record<string, unknown> | null = null) {
  const linha = linhaExistente ? { ...linhaExistente } : null;
  return {
    configuracaoDesconto: {
      findFirst: jest.fn().mockImplementation(async () => linha),
      create: jest.fn().mockImplementation(async () => ({
        id: 'config-1',
        limitePercentual: decimalFake(20),
        atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
      })),
      update: jest
        .fn()
        .mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'config-1',
          limitePercentual: data.limitePercentual
            ? decimalFake(data.limitePercentual as number)
            : (linha?.limitePercentual ?? decimalFake(20)),
          atualizadoEm: new Date('2026-01-02T00:00:00.000Z'),
        })),
    },
  };
}

describe('ConfiguracaoDescontoService', () => {
  it('obter() cria a linha com default 20% quando nao existe nenhuma', async () => {
    const prisma = prismaFake(null);
    const service = new ConfiguracaoDescontoService(prisma as never);

    const config = await service.obter();

    expect(prisma.configuracaoDesconto.create).toHaveBeenCalled();
    expect(config).toEqual({
      limitePercentual: 20,
      atualizadoEm: '2026-01-01T00:00:00.000Z',
    });
  });

  it('atualizar() grava o novo limite', async () => {
    const prisma = prismaFake({
      id: 'config-1',
      limitePercentual: decimalFake(20),
      atualizadoEm: new Date(),
    });
    const service = new ConfiguracaoDescontoService(prisma as never);

    const config = await service.atualizar({ limitePercentual: 25 });

    expect(prisma.configuracaoDesconto.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: { limitePercentual: 25 },
    });
    expect(config.limitePercentual).toBe(25);
  });

  it('obterLimitePercentual() devolve so o numero', async () => {
    const prisma = prismaFake({
      id: 'config-1',
      limitePercentual: decimalFake(20),
      atualizadoEm: new Date(),
    });
    const service = new ConfiguracaoDescontoService(prisma as never);

    expect(await service.obterLimitePercentual()).toBe(20);
  });
});
