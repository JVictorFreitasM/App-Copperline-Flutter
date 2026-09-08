import { NotFoundException } from '@nestjs/common';
import { TabelasPrecoService } from './tabelas-preco.service';

function decimalFake(valor: string) {
  return { toString: () => valor };
}

function tabelaFake(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    codigo: '110',
    ativa: true,
    padrao: false,
    sincronizadoEm: new Date('2026-09-08T00:00:00.000Z'),
    _count: { itens: 3 },
    ...overrides,
  };
}

function itemFake(overrides: Record<string, unknown> = {}) {
  return {
    id: 'i1',
    codigoItem: '50191',
    preco: decimalFake('2600.02'),
    precoPromocional: null,
    quantidadeMinima: decimalFake('0.0000'),
    quantidadeMaxima: decimalFake('99999999999999.0000'),
    percentualDescontoMaximo: decimalFake('2.00'),
    valorDescontoMaximo: decimalFake('0.00'),
    dataUltimoReajuste: null,
    dataInicioPromocao: null,
    dataFimPromocao: null,
    ...overrides,
  };
}

function prismaFake(overrides: {
  tabelas?: unknown[];
  tabela?: unknown | null;
  itens?: unknown[];
  totalItens?: number;
} = {}) {
  return {
    tabelaPreco: {
      findMany: jest.fn().mockResolvedValue(overrides.tabelas ?? []),
      findUnique: jest
        .fn()
        .mockResolvedValue(overrides.tabela === undefined ? tabelaFake() : overrides.tabela),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue(tabelaFake({ padrao: true })),
    },
    itemTabelaPreco: {
      findMany: jest.fn().mockResolvedValue(overrides.itens ?? []),
      count: jest.fn().mockResolvedValue(overrides.totalItens ?? 0),
    },
    $transaction: jest.fn((ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return (ops as (tx: unknown) => unknown)({});
    }),
  };
}

describe('TabelasPrecoService.buscarPorId', () => {
  it('lanca NotFoundException quando a tabela nao existe', async () => {
    const service = new TabelasPrecoService(prismaFake({ tabela: null }) as never);

    await expect(service.buscarPorId('inexistente')).rejects.toThrow(NotFoundException);
  });

  it('mapeia quantidadeItens a partir do _count', async () => {
    const service = new TabelasPrecoService(
      prismaFake({ tabela: tabelaFake({ _count: { itens: 7 } }) }) as never,
    );

    const resultado = await service.buscarPorId('t1');

    expect(resultado.quantidadeItens).toBe(7);
  });
});

describe('TabelasPrecoService.listarItens', () => {
  it('lanca NotFoundException quando a tabela nao existe', async () => {
    const service = new TabelasPrecoService(prismaFake({ tabela: null }) as never);

    await expect(
      service.listarItens('inexistente', { page: 1, limit: 20 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('retorna itens paginados com o preco convertido pra string', async () => {
    const service = new TabelasPrecoService(
      prismaFake({ itens: [itemFake()], totalItens: 1 }) as never,
    );

    const resultado = await service.listarItens('t1', { page: 1, limit: 20 });

    expect(resultado.data[0].preco).toBe('2600.02');
    expect(resultado.meta.total).toBe(1);
  });
});

describe('TabelasPrecoService.definirPadrao', () => {
  it('lanca NotFoundException quando a tabela nao existe', async () => {
    const service = new TabelasPrecoService(prismaFake({ tabela: null }) as never);

    await expect(service.definirPadrao('inexistente')).rejects.toThrow(NotFoundException);
  });

  it('desmarca as demais tabelas padrao antes de marcar a escolhida', async () => {
    const prisma = prismaFake();
    const service = new TabelasPrecoService(prisma as never);

    await service.definirPadrao('t1');

    expect(prisma.tabelaPreco.updateMany).toHaveBeenCalledWith({
      where: { padrao: true, id: { not: 't1' } },
      data: { padrao: false },
    });
    expect(prisma.tabelaPreco.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { padrao: true },
    });
  });
});
