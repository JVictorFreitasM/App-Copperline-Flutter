import { ConfiguracaoSyncEstoqueService } from './configuracao-sync-estoque.service';

function prismaFake(configuracaoExistente: { id: string; intervaloSincronizacaoMinutos: number } | null) {
  const configuracoes = configuracaoExistente ? [configuracaoExistente] : [];
  return {
    configuracaoEstoque: {
      findFirst: jest.fn(async () => configuracoes[0] ?? null),
      create: jest.fn(async ({ data }: { data: { intervaloSincronizacaoMinutos: number } }) => {
        const nova = { id: 'nova-config', ...data };
        configuracoes.push(nova);
        return nova;
      }),
      update: jest.fn(async ({ data }: { data: Partial<{ intervaloSincronizacaoMinutos: number }> }) => {
        Object.assign(configuracoes[0], data);
        return configuracoes[0];
      }),
    },
    syncEntity: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };
}

function queueFake() {
  return {
    upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue(undefined),
  };
}

describe('ConfiguracaoSyncEstoqueService', () => {
  it('onModuleInit cria configuracao com padrao de 30 minutos quando nao existe nenhuma', async () => {
    const prisma = prismaFake(null);
    const queue = queueFake();
    const service = new ConfiguracaoSyncEstoqueService(prisma as never, queue as never);

    await service.onModuleInit();

    expect(prisma.configuracaoEstoque.create).toHaveBeenCalledWith({
      data: { intervaloSincronizacaoMinutos: 30 },
    });
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'saldo-estoque-repeat',
      { every: 30 * 60_000 },
      { name: 'sync.entidade', data: { nomeEntidade: 'saldo_estoque' } },
    );
    // Disparo imediato adicional (nao espera o primeiro intervalo) - ver
    // comentario em onModuleInit.
    expect(queue.add).toHaveBeenCalledWith('sync.entidade', {
      nomeEntidade: 'saldo_estoque',
    });
  });

  it('atualizar() grava o novo intervalo e reregistra o job repetido com o novo valor em ms', async () => {
    const prisma = prismaFake({ id: 'config-1', intervaloSincronizacaoMinutos: 30 });
    const queue = queueFake();
    const service = new ConfiguracaoSyncEstoqueService(prisma as never, queue as never);

    await service.atualizar(120);

    expect(prisma.configuracaoEstoque.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: { intervaloSincronizacaoMinutos: 120 },
    });
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'saldo-estoque-repeat',
      { every: 120 * 60_000 },
      { name: 'sync.entidade', data: { nomeEntidade: 'saldo_estoque' } },
    );
  });

  it('obter() retorna null em ultimaSincronizacaoEm quando a entidade nunca sincronizou', async () => {
    const prisma = prismaFake({ id: 'config-1', intervaloSincronizacaoMinutos: 45 });
    const service = new ConfiguracaoSyncEstoqueService(
      prisma as never,
      queueFake() as never,
    );

    const resultado = await service.obter();

    expect(resultado).toEqual({
      intervaloSincronizacaoMinutos: 45,
      ultimaSincronizacaoEm: null,
    });
  });
});
