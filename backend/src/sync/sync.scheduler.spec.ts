import type { Queue } from 'bullmq';
import { SyncScheduler } from './sync.scheduler';
import type { SyncScheduling, SyncStrategy } from './sync-strategy.interface';

function strategyFake(nomeEntidade: string, agendamento?: SyncScheduling) {
  return { nomeEntidade, agendamento } as SyncStrategy;
}

function prismaFake(nomesComConfig: string[] = []) {
  return {
    configuracaoSync: {
      findMany: jest
        .fn()
        .mockResolvedValue(nomesComConfig.map((nomeEntidade) => ({ nomeEntidade }))),
    },
  };
}

describe('SyncScheduler', () => {
  it('agendarIncrementais enfileira so strategies INCREMENTAL (ou sem agendamento declarado)', async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const queue = { add } as unknown as Queue;
    const strategies = [
      strategyFake('cliente'), // sem agendamento -> default INCREMENTAL
      strategyFake('produto', 'INCREMENTAL_NOTURNO'),
      strategyFake('nota-fiscal', 'JANELA_FIXA_DIARIA'),
    ];

    const scheduler = new SyncScheduler(queue, strategies, prismaFake() as never);
    await scheduler.agendarIncrementais();

    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith('sync.entidade', {
      nomeEntidade: 'cliente',
    });
  });

  it('agendarIncrementaisNoturnos enfileira so strategies INCREMENTAL_NOTURNO', async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const queue = { add } as unknown as Queue;
    const strategies = [
      strategyFake('cliente'),
      strategyFake('produto', 'INCREMENTAL_NOTURNO'),
      strategyFake('pedido', 'INCREMENTAL_NOTURNO'),
      strategyFake('nota-fiscal', 'JANELA_FIXA_DIARIA'),
    ];

    const scheduler = new SyncScheduler(queue, strategies, prismaFake() as never);
    await scheduler.agendarIncrementaisNoturnos();

    expect(add).toHaveBeenCalledTimes(2);
    expect(add).toHaveBeenCalledWith('sync.entidade', {
      nomeEntidade: 'produto',
    });
    expect(add).toHaveBeenCalledWith('sync.entidade', {
      nomeEntidade: 'pedido',
    });
  });

  it('agendarJanelaFixaDiaria enfileira so strategies JANELA_FIXA_DIARIA', async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const queue = { add } as unknown as Queue;
    const strategies = [
      strategyFake('cliente'),
      strategyFake('produto', 'INCREMENTAL_NOTURNO'),
      strategyFake('nota-fiscal', 'JANELA_FIXA_DIARIA'),
    ];

    const scheduler = new SyncScheduler(queue, strategies, prismaFake() as never);
    await scheduler.agendarJanelaFixaDiaria();

    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith('sync.entidade', {
      nomeEntidade: 'nota-fiscal',
    });
  });

  it('exclui entidades que ja tem ConfiguracaoSync salva (cobertas pelo Job Scheduler proprio)', async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const queue = { add } as unknown as Queue;
    const strategies = [strategyFake('cliente'), strategyFake('produto')];

    const scheduler = new SyncScheduler(
      queue,
      strategies,
      prismaFake(['cliente']) as never,
    );
    await scheduler.agendarIncrementais();

    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith('sync.entidade', {
      nomeEntidade: 'produto',
    });
  });
});
