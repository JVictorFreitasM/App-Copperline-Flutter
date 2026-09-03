import { ConfiguracaoGamificacaoService } from './configuracao-gamificacao.service';

function prismaFake(linhaExistente: Record<string, unknown> | null = null) {
  const linha = linhaExistente ? { ...linhaExistente } : null;
  return {
    configuracaoGamificacao: {
      findFirst: jest.fn().mockImplementation(async () => linha),
      create: jest.fn().mockImplementation(async () => ({
        id: 'config-1',
        rankingVisivelParaVendedor: false,
        atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
      })),
      update: jest
        .fn()
        .mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'config-1',
          rankingVisivelParaVendedor: data.rankingVisivelParaVendedor,
          atualizadoEm: new Date('2026-01-02T00:00:00.000Z'),
        })),
    },
  };
}

describe('ConfiguracaoGamificacaoService', () => {
  it('obter() cria a linha com default false (fail-closed) quando nao existe nenhuma', async () => {
    const prisma = prismaFake(null);
    const service = new ConfiguracaoGamificacaoService(prisma as never);

    const config = await service.obter();

    expect(prisma.configuracaoGamificacao.create).toHaveBeenCalled();
    expect(config).toEqual({
      rankingVisivelParaVendedor: false,
      atualizadoEm: '2026-01-01T00:00:00.000Z',
    });
  });

  it('atualizar() grava o novo valor da flag', async () => {
    const prisma = prismaFake({
      id: 'config-1',
      rankingVisivelParaVendedor: false,
      atualizadoEm: new Date(),
    });
    const service = new ConfiguracaoGamificacaoService(prisma as never);

    const config = await service.atualizar(true);

    expect(prisma.configuracaoGamificacao.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: { rankingVisivelParaVendedor: true },
    });
    expect(config.rankingVisivelParaVendedor).toBe(true);
  });

  it('obterRankingVisivelParaVendedor() devolve so o booleano', async () => {
    const prisma = prismaFake({
      id: 'config-1',
      rankingVisivelParaVendedor: true,
      atualizadoEm: new Date(),
    });
    const service = new ConfiguracaoGamificacaoService(prisma as never);

    expect(await service.obterRankingVisivelParaVendedor()).toBe(true);
  });
});
