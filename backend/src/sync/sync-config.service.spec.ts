import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SyncConfigService } from './sync-config.service';
import type { SyncStrategy } from './sync-strategy.interface';

function strategyFake(nomeEntidade: string, agendamento?: SyncStrategy['agendamento']) {
  return { nomeEntidade, agendamento } as SyncStrategy;
}

function prismaFake(
  configuracoes: Record<string, unknown>[] = [],
  syncEntities: { nome: string; ultimaSincronizacao: Date | null }[] = [],
) {
  const linhas = [...configuracoes];
  return {
    configuracaoSync: {
      findMany: jest.fn().mockResolvedValue(linhas),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existente = linhas.find((c: any) => c.nomeEntidade === where.nomeEntidade);
        if (existente) {
          Object.assign(existente, update);
          return existente;
        }
        linhas.push(create);
        return create;
      }),
    },
    syncEntity: {
      findMany: jest.fn().mockResolvedValue(syncEntities),
      findUnique: jest.fn(
        async ({ where }: any) =>
          syncEntities.find((e) => e.nome === where.nome) ?? null,
      ),
    },
  };
}

function queueFake() {
  return {
    upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue(undefined),
  };
}

describe('SyncConfigService.listar', () => {
  it('entidade sem ConfiguracaoSync salva volta com origem PADRAO e os valores default por cadencia', async () => {
    const strategies = [
      strategyFake('cliente'), // sem agendamento -> INCREMENTAL
      strategyFake('produto', 'INCREMENTAL_NOTURNO'),
    ];
    const service = new SyncConfigService(
      prismaFake([]) as never,
      queueFake() as never,
      strategies,
    );

    const resultado = await service.listar();

    expect(resultado).toEqual([
      {
        nomeEntidade: 'cliente',
        tipoCadencia: 'INCREMENTAL',
        intervaloMinutos: 30,
        horarioFixo: null,
        diasSemana: [],
        janelaReprocessamentoDias: null,
        origem: 'PADRAO',
        ultimaSincronizacaoEm: null,
      },
      {
        nomeEntidade: 'produto',
        tipoCadencia: 'INCREMENTAL_NOTURNO',
        intervaloMinutos: null,
        horarioFixo: '00:00',
        diasSemana: [],
        janelaReprocessamentoDias: null,
        origem: 'PADRAO',
        ultimaSincronizacaoEm: null,
      },
    ]);
  });

  it('entidade com ConfiguracaoSync salva volta com origem CONFIGURADA e o valor salvo', async () => {
    const strategies = [strategyFake('saldo_estoque', 'CONFIGURAVEL')];
    const prisma = prismaFake(
      [
        {
          nomeEntidade: 'saldo_estoque',
          tipoCadencia: 'CONFIGURAVEL',
          intervaloMinutos: 120,
          horarioFixo: null,
          diasSemana: [],
        },
      ],
      [{ nome: 'saldo_estoque', ultimaSincronizacao: new Date('2026-01-01T00:00:00.000Z') }],
    );
    const service = new SyncConfigService(prisma as never, queueFake() as never, strategies);

    const resultado = await service.listar();

    expect(resultado[0]).toEqual({
      nomeEntidade: 'saldo_estoque',
      tipoCadencia: 'CONFIGURAVEL',
      intervaloMinutos: 120,
      horarioFixo: null,
      diasSemana: [],
      janelaReprocessamentoDias: null,
      origem: 'CONFIGURADA',
      ultimaSincronizacaoEm: '2026-01-01T00:00:00.000Z',
    });
  });

  it('entidade nota-fiscal sem ConfiguracaoSync salva mostra o padrao de 60 dias (OS-BACKEND-38)', async () => {
    const strategies = [strategyFake('nota-fiscal', 'JANELA_FIXA_DIARIA')];
    const prisma = prismaFake([], []);
    const service = new SyncConfigService(prisma as never, queueFake() as never, strategies);

    const resultado = await service.listar();

    expect(resultado[0].janelaReprocessamentoDias).toBe(60);
  });

  it('entidade nota-fiscal com janelaReprocessamentoDias configurada mostra o valor salvo, nao o padrao', async () => {
    const strategies = [strategyFake('nota-fiscal', 'JANELA_FIXA_DIARIA')];
    const prisma = prismaFake(
      [
        {
          nomeEntidade: 'nota-fiscal',
          tipoCadencia: 'JANELA_FIXA_DIARIA',
          intervaloMinutos: null,
          horarioFixo: '03:15',
          diasSemana: [],
          janelaReprocessamentoDias: 15,
        },
      ],
      [],
    );
    const service = new SyncConfigService(prisma as never, queueFake() as never, strategies);

    const resultado = await service.listar();

    expect(resultado[0].janelaReprocessamentoDias).toBe(15);
  });
});

describe('SyncConfigService.atualizar', () => {
  it('salva a config e registra o Job Scheduler com as opcoes convertidas', async () => {
    const strategies = [strategyFake('cliente')];
    const prisma = prismaFake([]);
    const queue = queueFake();
    const service = new SyncConfigService(prisma as never, queue as never, strategies);

    await service.atualizar('cliente', { tipoCadencia: 'CONFIGURAVEL', intervaloMinutos: 60 });

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'cliente-repeat',
      { every: 60 * 60_000 },
      { name: 'sync.entidade', data: { nomeEntidade: 'cliente' } },
    );
  });

  it('rejeita tipoCadencia INCREMENTAL pra nota-fiscal', async () => {
    const strategies = [strategyFake('nota-fiscal', 'JANELA_FIXA_DIARIA')];
    const service = new SyncConfigService(
      prismaFake([]) as never,
      queueFake() as never,
      strategies,
    );

    await expect(
      service.atualizar('nota-fiscal', { tipoCadencia: 'INCREMENTAL', intervaloMinutos: 30 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita tipoCadencia INCREMENTAL pra saldo_estoque', async () => {
    const strategies = [strategyFake('saldo_estoque', 'CONFIGURAVEL')];
    const service = new SyncConfigService(
      prismaFake([]) as never,
      queueFake() as never,
      strategies,
    );

    await expect(
      service.atualizar('saldo_estoque', { tipoCadencia: 'INCREMENTAL', intervaloMinutos: 30 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanca NotFoundException para entidade desconhecida', async () => {
    const service = new SyncConfigService(
      prismaFake([]) as never,
      queueFake() as never,
      [strategyFake('cliente')],
    );

    await expect(
      service.atualizar('inexistente', { tipoCadencia: 'CONFIGURAVEL', intervaloMinutos: 30 }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('SyncConfigService.executarAgora', () => {
  it('enfileira um job avulso pra entidade conhecida', async () => {
    const queue = queueFake();
    const service = new SyncConfigService(
      prismaFake([]) as never,
      queue as never,
      [strategyFake('produto', 'INCREMENTAL_NOTURNO')],
    );

    await service.executarAgora('produto');

    expect(queue.add).toHaveBeenCalledWith('sync.entidade', { nomeEntidade: 'produto' });
  });

  it('lanca NotFoundException para entidade desconhecida', async () => {
    const service = new SyncConfigService(
      prismaFake([]) as never,
      queueFake() as never,
      [strategyFake('cliente')],
    );

    await expect(service.executarAgora('inexistente')).rejects.toThrow(NotFoundException);
  });
});

describe('SyncConfigService.onModuleInit', () => {
  it('registra o Job Scheduler pra cada ConfiguracaoSync ja salva', async () => {
    const queue = queueFake();
    const prisma = prismaFake([
      {
        nomeEntidade: 'saldo_estoque',
        tipoCadencia: 'CONFIGURAVEL',
        intervaloMinutos: 45,
        horarioFixo: null,
        diasSemana: [],
      },
    ]);
    const service = new SyncConfigService(prisma as never, queue as never, [
      strategyFake('saldo_estoque', 'CONFIGURAVEL'),
    ]);

    await service.onModuleInit();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'saldo_estoque-repeat',
      { every: 45 * 60_000 },
      { name: 'sync.entidade', data: { nomeEntidade: 'saldo_estoque' } },
    );
  });
});
