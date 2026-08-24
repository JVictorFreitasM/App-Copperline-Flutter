import { ConfiguracaoLlmService } from './configuracao-llm.service';

function prismaFake(linhaExistente: Record<string, unknown> | null = null) {
  const linha = linhaExistente
    ? { ...linhaExistente }
    : null;
  return {
    configuracaoLlm: {
      findFirst: jest.fn().mockImplementation(async () => linha),
      create: jest.fn().mockImplementation(async () => ({
        id: 'config-1',
        provedor: 'openrouter',
        apiKey: null,
        modelo: 'anthropic/claude-opus-5',
        atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
      })),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'config-1',
        provedor: data.provedor ?? linha?.provedor ?? 'openrouter',
        apiKey: data.apiKey ?? linha?.apiKey ?? null,
        modelo: data.modelo ?? linha?.modelo ?? 'anthropic/claude-opus-5',
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
      apiKeyConfigurada: false,
      atualizadoEm: '2026-01-01T00:00:00.000Z',
    });
  });

  it('obter() NUNCA retorna a apiKey em si, so o booleano apiKeyConfigurada', async () => {
    const prisma = prismaFake({
      id: 'config-1',
      provedor: 'openrouter',
      apiKey: 'sk-or-super-secreta',
      modelo: 'anthropic/claude-opus-5',
      atualizadoEm: new Date(),
    });
    const service = new ConfiguracaoLlmService(prisma as never);

    const config = await service.obter();

    expect(config.apiKeyConfigurada).toBe(true);
    expect(JSON.stringify(config)).not.toContain('sk-or-super-secreta');
  });

  it('atualizar() grava so os campos informados', async () => {
    const prisma = prismaFake({
      id: 'config-1',
      provedor: 'openrouter',
      apiKey: null,
      modelo: 'anthropic/claude-opus-5',
      atualizadoEm: new Date(),
    });
    const service = new ConfiguracaoLlmService(prisma as never);

    await service.atualizar({ apiKey: 'sk-or-nova-chave' });

    expect(prisma.configuracaoLlm.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: { provedor: undefined, apiKey: 'sk-or-nova-chave', modelo: undefined },
    });
  });

  it('obterCredenciais() e o unico ponto que devolve a apiKey crua', async () => {
    const prisma = prismaFake({
      id: 'config-1',
      provedor: 'openrouter',
      apiKey: 'sk-or-super-secreta',
      modelo: 'anthropic/claude-opus-5',
      atualizadoEm: new Date(),
    });
    const service = new ConfiguracaoLlmService(prisma as never);

    const credenciais = await service.obterCredenciais();

    expect(credenciais.apiKey).toBe('sk-or-super-secreta');
  });
});
