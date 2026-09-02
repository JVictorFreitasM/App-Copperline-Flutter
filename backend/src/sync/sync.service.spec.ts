import { SyncService } from './sync.service';
import type { SyncStrategy, SyncWindow } from './sync-strategy.interface';

function prismaFake(overrides: { ultimaSincronizacao?: Date | null }) {
  const syncEntity = {
    id: 'entity-1',
    nome: 'cliente',
    ultimaSincronizacao: overrides.ultimaSincronizacao ?? null,
  };
  return {
    syncEntity: {
      upsert: jest.fn().mockResolvedValue(syncEntity),
      update: jest.fn().mockResolvedValue(undefined),
    },
    syncLog: {
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

function configServiceFake(valores: Record<string, string> = {}) {
  return {
    get: jest.fn((chave: string) => valores[chave]),
  };
}

// Retorna a strategy (tipada, pro construtor do SyncService) junto do mock
// de fetch (tipado como jest.Mock, sem cast) - evita `as jest.Mock` nos
// testes, que o eslint recusa (no-unsafe-*, unbound-method).
type FetchFn = (
  janela: SyncWindow,
) => Promise<{ registros: unknown[]; avisos: string[] }>;

function strategyFake(): {
  strategy: SyncStrategy;
  fetchMock: jest.MockedFunction<FetchFn>;
} {
  const fetchMock = jest.fn() as jest.MockedFunction<FetchFn>;
  fetchMock.mockResolvedValue({ registros: [], avisos: [] });

  const strategy: SyncStrategy = {
    nomeEntidade: 'cliente',
    fetch: fetchMock,
    map: (bruto: unknown) => bruto,
    upsert: () => Promise.resolve(),
  };

  return { strategy, fetchMock };
}

describe('SyncService.executar - carga inicial vs incremental', () => {
  it('nunca usa new Date(0) - lanca erro claro quando e a primeira sincronizacao e nao ha data de inicio configurada', async () => {
    const prisma = prismaFake({ ultimaSincronizacao: null });
    const { strategy, fetchMock } = strategyFake();
    const service = new SyncService(
      prisma as never,
      configServiceFake() as never,
      [strategy],
    );

    await expect(service.executar('cliente')).rejects.toThrow(
      /WK_RADAR_CLIENTE_DATA_INICIO_CARGA/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('usa a data de inicio de carga configurada quando e a primeira sincronizacao (sem cursor)', async () => {
    const prisma = prismaFake({ ultimaSincronizacao: null });
    const { strategy, fetchMock } = strategyFake();
    const service = new SyncService(
      prisma as never,
      configServiceFake({
        WK_RADAR_CLIENTE_DATA_INICIO_CARGA: '2024-01-01',
      }) as never,
      [strategy],
    );

    await service.executar('cliente');

    const janela = fetchMock.mock.calls[0][0];
    expect(janela.desde.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('usa o cursor salvo (ultimaSincronizacao) quando ja existe, ignorando a data de inicio de carga', async () => {
    const cursor = new Date('2026-06-01T00:00:00.000Z');
    const prisma = prismaFake({ ultimaSincronizacao: cursor });
    const { strategy, fetchMock } = strategyFake();
    const service = new SyncService(
      prisma as never,
      configServiceFake({
        WK_RADAR_CLIENTE_DATA_INICIO_CARGA: '2024-01-01',
      }) as never,
      [strategy],
    );

    await service.executar('cliente');

    const janela = fetchMock.mock.calls[0][0];
    expect(janela.desde).toBe(cursor);
  });

  it('nome de entidade com hifen vira underscore no nome da variavel de ambiente (bug real - OS-BACKEND-42)', async () => {
    // "nota-fiscal" virava WK_RADAR_NOTA-FISCAL_DATA_INICIO_CARGA (hifen),
    // uma variavel que nem .env nem docker-compose ${...} aceitam como
    // identificador valido - a entidade falhava em toda tentativa, ANTES
    // de gravar syncLog (nunca aparecia nem sucesso nem erro).
    const prisma = prismaFake({ ultimaSincronizacao: null });
    const fetchMock = jest.fn() as jest.MockedFunction<FetchFn>;
    fetchMock.mockResolvedValue({ registros: [], avisos: [] });
    const strategy: SyncStrategy = {
      nomeEntidade: 'nota-fiscal',
      fetch: fetchMock,
      map: (bruto: unknown) => bruto,
      upsert: () => Promise.resolve(),
    };
    const service = new SyncService(
      prisma as never,
      configServiceFake({
        WK_RADAR_NOTA_FISCAL_DATA_INICIO_CARGA: '2024-01-01',
      }) as never,
      [strategy],
    );

    await service.executar('nota-fiscal');

    expect(fetchMock).toHaveBeenCalled();
  });

  it('lanca erro claro quando WK_RADAR_<ENTIDADE>_DATA_INICIO_CARGA configurada nao e uma data valida', async () => {
    const prisma = prismaFake({ ultimaSincronizacao: null });
    const { strategy } = strategyFake();
    const service = new SyncService(
      prisma as never,
      configServiceFake({
        WK_RADAR_CLIENTE_DATA_INICIO_CARGA: 'nao-e-uma-data',
      }) as never,
      [strategy],
    );

    await expect(service.executar('cliente')).rejects.toThrow(/invalida/);
  });
});
