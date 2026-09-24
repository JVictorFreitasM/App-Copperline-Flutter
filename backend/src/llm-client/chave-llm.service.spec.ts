import { NotFoundException } from '@nestjs/common';
import { ChaveLlmService } from './chave-llm.service';

function segredoCryptoFake() {
  return {
    criptografar: jest.fn().mockImplementation((texto: string) => `cifrado:${texto}`),
    descriptografar: jest.fn().mockImplementation((cifrado: string) => {
      if (!cifrado.startsWith('cifrado:')) {
        throw new Error('formato invalido');
      }
      return cifrado.slice('cifrado:'.length);
    }),
  };
}

function chaveBruta(overrides: Record<string, unknown> = {}) {
  return {
    id: 'chave-1',
    rotulo: 'Principal',
    apiKey: 'cifrado:sk-teste-1234',
    ordem: 0,
    ativa: true,
    criadoEm: new Date('2026-01-01T00:00:00.000Z'),
    atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function prismaFake(overrides: {
  chaves?: Record<string, unknown>[];
  chaveEncontrada?: Record<string, unknown> | null;
  maiorOrdem?: number | null;
} = {}) {
  return {
    chaveLlm: {
      findMany: jest.fn().mockResolvedValue(overrides.chaves ?? []),
      findUnique: jest
        .fn()
        .mockResolvedValue('chaveEncontrada' in overrides ? overrides.chaveEncontrada : chaveBruta()),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        chaveBruta({ id: 'chave-nova', ...data }),
      ),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        chaveBruta({ ...data }),
      ),
      delete: jest.fn().mockResolvedValue(undefined),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      aggregate: jest.fn().mockResolvedValue({ _max: { ordem: overrides.maiorOrdem ?? null } }),
    },
    $transaction: jest.fn(async (operacoes: Promise<unknown>[]) => Promise.all(operacoes)),
  };
}

describe('ChaveLlmService', () => {
  it('listar() nunca expoe a apiKey crua, so um preview mascarado', async () => {
    const prisma = prismaFake({ chaves: [chaveBruta()] });
    const service = new ChaveLlmService(prisma as never, segredoCryptoFake() as never);

    const chaves = await service.listar();

    expect(chaves[0].chavePreview).toBe('••••1234');
    expect(JSON.stringify(chaves)).not.toContain('sk-teste-1234');
  });

  it('criar() criptografa a apiKey e usa a proxima ordem disponivel', async () => {
    const prisma = prismaFake({ maiorOrdem: 2 });
    const segredoCrypto = segredoCryptoFake();
    const service = new ChaveLlmService(prisma as never, segredoCrypto as never);

    await service.criar({ rotulo: 'Backup', apiKey: 'sk-nova' });

    expect(segredoCrypto.criptografar).toHaveBeenCalledWith('sk-nova');
    expect(prisma.chaveLlm.create).toHaveBeenCalledWith({
      data: { rotulo: 'Backup', apiKey: 'cifrado:sk-nova', ordem: 3 },
    });
  });

  it('criar() comeca em ordem 0 quando nao ha nenhuma chave ainda', async () => {
    const prisma = prismaFake({ maiorOrdem: null });
    const service = new ChaveLlmService(prisma as never, segredoCryptoFake() as never);

    await service.criar({ rotulo: 'Primeira', apiKey: 'sk-1' });

    expect(prisma.chaveLlm.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ordem: 0 }) }),
    );
  });

  it('atualizar() lanca NotFoundException quando a chave nao existe', async () => {
    const prisma = prismaFake({ chaveEncontrada: null });
    const service = new ChaveLlmService(prisma as never, segredoCryptoFake() as never);

    await expect(service.atualizar('inexistente', { ativa: false })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('remover() lanca NotFoundException quando a chave nao existe', async () => {
    const prisma = prismaFake({ chaveEncontrada: null });
    const service = new ChaveLlmService(prisma as never, segredoCryptoFake() as never);

    await expect(service.remover('inexistente')).rejects.toThrow(NotFoundException);
    expect(prisma.chaveLlm.delete).not.toHaveBeenCalled();
  });

  it('reordenar() atualiza a ordem de cada id pela posicao no array recebido', async () => {
    const prisma = prismaFake();
    const service = new ChaveLlmService(prisma as never, segredoCryptoFake() as never);

    await service.reordenar(['c3', 'c1', 'c2']);

    expect(prisma.chaveLlm.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'c3' },
      data: { ordem: 0 },
    });
    expect(prisma.chaveLlm.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'c1' },
      data: { ordem: 1 },
    });
    expect(prisma.chaveLlm.updateMany).toHaveBeenNthCalledWith(3, {
      where: { id: 'c2' },
      data: { ordem: 2 },
    });
  });

  it('listarCredenciaisAtivas() so retorna chaves ativas, decifradas, na ordem', async () => {
    const prisma = prismaFake({
      chaves: [
        chaveBruta({ id: 'c1', apiKey: 'cifrado:sk-1', ordem: 0 }),
        chaveBruta({ id: 'c2', apiKey: 'cifrado:sk-2', ordem: 1 }),
      ],
    });
    const service = new ChaveLlmService(prisma as never, segredoCryptoFake() as never);

    const credenciais = await service.listarCredenciaisAtivas();

    expect(prisma.chaveLlm.findMany).toHaveBeenCalledWith({
      where: { ativa: true },
      orderBy: { ordem: 'asc' },
    });
    expect(credenciais).toEqual([
      { id: 'c1', apiKey: 'sk-1' },
      { id: 'c2', apiKey: 'sk-2' },
    ]);
  });

  it('listarCredenciaisAtivas() pula chave que nao descriptografa mais, sem quebrar as demais', async () => {
    const prisma = prismaFake({
      chaves: [
        chaveBruta({ id: 'c1', apiKey: 'valor-legado-sem-prefixo' }),
        chaveBruta({ id: 'c2', apiKey: 'cifrado:sk-2' }),
      ],
    });
    const service = new ChaveLlmService(prisma as never, segredoCryptoFake() as never);

    const credenciais = await service.listarCredenciaisAtivas();

    expect(credenciais).toEqual([{ id: 'c2', apiKey: 'sk-2' }]);
  });
});
