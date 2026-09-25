import { ConfiguracaoLlmService } from './configuracao-llm.service';

function prismaFake(linhaExistente: Record<string, unknown> | null = null) {
  const linha = linhaExistente ? { ...linhaExistente } : null;
  return {
    configuracaoLlm: {
      findFirst: jest.fn().mockImplementation(async () => linha),
      create: jest.fn().mockImplementation(async () => ({
        id: 'config-1',
        provedor: 'openrouter',
        modelo: 'anthropic/claude-opus-5',
        fallbackAtivo: true,
        atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
      })),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'config-1',
        provedor: data.provedor ?? linha?.provedor ?? 'openrouter',
        modelo: data.modelo ?? linha?.modelo ?? 'anthropic/claude-opus-5',
        fallbackAtivo: data.fallbackAtivo ?? linha?.fallbackAtivo ?? true,
        atualizadoEm: new Date('2026-01-02T00:00:00.000Z'),
      })),
    },
  };
}

describe('ConfiguracaoLlmService', () => {
  it('obter() cria a linha com defaults quando nao existe nenhuma', async () => {
    const prisma = prismaFake(null);
    const service = new ConfiguracaoLlmService(prisma as never);

    const config = await service.obter();

    expect(prisma.configuracaoLlm.create).toHaveBeenCalled();
    expect(config).toEqual({
      provedor: 'openrouter',
      modelo: 'anthropic/claude-opus-5',
      fallbackAtivo: true,
      atualizadoEm: '2026-01-01T00:00:00.000Z',
    });
  });

  it('atualizar() grava so os campos informados', async () => {
    const prisma = prismaFake({
      id: 'config-1',
      provedor: 'openrouter',
      modelo: 'anthropic/claude-opus-5',
      fallbackAtivo: true,
      atualizadoEm: new Date(),
    });
    const service = new ConfiguracaoLlmService(prisma as never);

    const config = await service.atualizar({ modelo: 'openai/gpt-5' });

    expect(prisma.configuracaoLlm.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: { provedor: undefined, modelo: 'openai/gpt-5', fallbackAtivo: undefined },
    });
    expect(config.modelo).toBe('openai/gpt-5');
  });

  it('atualizar() desliga o fallback quando fallbackAtivo:false e informado', async () => {
    const prisma = prismaFake({
      id: 'config-1',
      provedor: 'openrouter',
      modelo: 'anthropic/claude-opus-5',
      fallbackAtivo: true,
      atualizadoEm: new Date(),
    });
    const service = new ConfiguracaoLlmService(prisma as never);

    const config = await service.atualizar({ fallbackAtivo: false });

    expect(prisma.configuracaoLlm.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: { provedor: undefined, modelo: undefined, fallbackAtivo: false },
    });
    expect(config.fallbackAtivo).toBe(false);
  });
});
