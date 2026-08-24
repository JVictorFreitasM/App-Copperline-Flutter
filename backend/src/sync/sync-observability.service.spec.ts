import { NotFoundException } from '@nestjs/common';
import { SyncObservabilityService } from './sync-observability.service';
import type { SyncStrategy } from './sync-strategy.interface';

function strategyFake(nomeEntidade: string) {
  return { nomeEntidade } as SyncStrategy;
}

function prismaFake(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    syncEntity: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    syncLog: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    cliente: { findMany: jest.fn().mockResolvedValue([]) },
    produto: { findMany: jest.fn().mockResolvedValue([]) },
    pedido: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    ...overrides,
  };
}

describe('SyncObservabilityService.listarLogs', () => {
  it('lanca NotFoundException para entidade desconhecida', async () => {
    const service = new SyncObservabilityService(prismaFake() as never, [
      strategyFake('cliente'),
    ]);

    await expect(service.listarLogs('inexistente', 1, 20)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('retorna resultado vazio quando a entidade existe mas nunca sincronizou (sem SyncEntity)', async () => {
    const service = new SyncObservabilityService(prismaFake() as never, [
      strategyFake('cliente'),
    ]);

    const resultado = await service.listarLogs('cliente', 1, 20);

    expect(resultado).toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('mapeia logs com avisos como lista legivel e calcula duracaoMs', async () => {
    const iniciadoEm = new Date('2026-01-01T10:00:00.000Z');
    const finalizadoEm = new Date('2026-01-01T10:00:05.000Z');
    const prisma = prismaFake({
      syncEntity: { findUnique: jest.fn().mockResolvedValue({ id: 'se-1', nome: 'cliente' }) },
      syncLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'log-1',
            status: 'SUCESSO',
            iniciadoEm,
            finalizadoEm,
            registrosProcessados: 10,
            registrosComErro: 0,
            avisos: ['sub-janela suspeita de truncamento'],
            erro: null,
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    });
    const service = new SyncObservabilityService(prisma as never, [strategyFake('cliente')]);

    const resultado = await service.listarLogs('cliente', 1, 20);

    expect(resultado.data[0]).toEqual({
      id: 'log-1',
      status: 'SUCESSO',
      iniciadoEm: '2026-01-01T10:00:00.000Z',
      finalizadoEm: '2026-01-01T10:00:05.000Z',
      duracaoMs: 5000,
      registrosProcessados: 10,
      registrosComErro: 0,
      avisos: ['sub-janela suspeita de truncamento'],
      erro: null,
    });
  });

  it('log ainda EM_ANDAMENTO (sem finalizadoEm) volta com duracaoMs null', async () => {
    const prisma = prismaFake({
      syncEntity: { findUnique: jest.fn().mockResolvedValue({ id: 'se-1', nome: 'cliente' }) },
      syncLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'log-1',
            status: 'EM_ANDAMENTO',
            iniciadoEm: new Date(),
            finalizadoEm: null,
            registrosProcessados: 0,
            registrosComErro: 0,
            avisos: null,
            erro: null,
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    });
    const service = new SyncObservabilityService(prisma as never, [strategyFake('cliente')]);

    const resultado = await service.listarLogs('cliente', 1, 20);

    expect(resultado.data[0].duracaoMs).toBeNull();
    expect(resultado.data[0].avisos).toEqual([]);
  });
});

describe('SyncObservabilityService.listarRegistrosIncompletos', () => {
  it('agrupa por tipo e calcula a idade em horas a partir de sincronizadoEm', async () => {
    const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const prisma = prismaFake({
      cliente: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'c1', idExternoErp: 'EXT-1', sincronizadoEm: duasHorasAtras },
          ]),
      },
      produto: { findMany: jest.fn().mockResolvedValue([]) },
      pedido: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const service = new SyncObservabilityService(prisma as never, []);

    const resultado = await service.listarRegistrosIncompletos();

    expect(resultado.produto).toEqual([]);
    expect(resultado.pedido).toEqual([]);
    expect(resultado.cliente).toHaveLength(1);
    expect(resultado.cliente[0].idExternoErp).toBe('EXT-1');
    expect(resultado.cliente[0].idadeEmHoras).toBeCloseTo(2, 1);
  });
});
