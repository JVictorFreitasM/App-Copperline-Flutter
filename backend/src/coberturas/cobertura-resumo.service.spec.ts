import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CoberturaResumoService } from './cobertura-resumo.service';

const IDP_USER = { sub: 's1', email: 'a@a.com', name: 'A', role: null as string | null, system: 'x' };
const IDP_USER_ADMIN = { ...IDP_USER, role: 'admin' };

function decimalFake(valor: number) {
  return { toString: () => String(valor) };
}

function prismaFake(overrides: {
  cobertura?: Record<string, unknown> | null;
  vendedorAtual?: Record<string, unknown> | null;
  clientes?: Record<string, unknown>[];
}) {
  return {
    coberturaTemporaria: {
      findUnique: jest.fn().mockResolvedValue(
        overrides.cobertura === undefined
          ? { id: 'cob-1', vendedorOriginalId: 'v-original', vendedorSubstitutoId: 'v-sub' }
          : overrides.cobertura,
      ),
    },
    vendedor: {
      findFirst: jest.fn().mockResolvedValue(overrides.vendedorAtual ?? { id: 'v-sub' }),
    },
    cliente: {
      findMany: jest.fn().mockResolvedValue(overrides.clientes ?? []),
    },
    pedido: {
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _avg: { valorTotal: decimalFake(0) } }),
    },
  };
}

function llmClientServiceFake(overrides: { resumo?: string; erro?: Error }) {
  return {
    gerarJson: jest.fn().mockImplementation(async () => {
      if (overrides.erro) throw overrides.erro;
      return { resumo: overrides.resumo ?? 'Resumo gerado pela IA.' };
    }),
  };
}

function redisFake(cacheado: string | null = null) {
  return {
    get: jest.fn().mockResolvedValue(cacheado),
    set: jest.fn().mockResolvedValue('OK'),
  };
}

describe('CoberturaResumoService.obterResumo', () => {
  it('lanca NotFoundException quando a cobertura nao existe', async () => {
    const prisma = prismaFake({ cobertura: null });
    const service = new CoberturaResumoService(
      prisma as never,
      llmClientServiceFake({}) as never,
      redisFake() as never,
    );

    await expect(service.obterResumo('inexistente', IDP_USER, 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lanca ForbiddenException quando quem pede nao e o vendedor substituto (evita IDOR)', async () => {
    const prisma = prismaFake({ vendedorAtual: { id: 'outro-vendedor' } });
    const service = new CoberturaResumoService(
      prisma as never,
      llmClientServiceFake({}) as never,
      redisFake() as never,
    );

    await expect(service.obterResumo('cob-1', IDP_USER, 'u1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('admin sempre pode consultar, mesmo sem ser o substituto', async () => {
    const prisma = prismaFake({ clientes: [{ id: 'c1', razaoSocial: 'Cliente Um', nomeFantasia: null }] });
    const service = new CoberturaResumoService(
      prisma as never,
      llmClientServiceFake({ resumo: 'Resumo pro admin.' }) as never,
      redisFake() as never,
    );

    const resultado = await service.obterResumo('cob-1', IDP_USER_ADMIN, 'u-admin');

    expect(resultado.clientes).toEqual([
      { clienteId: 'c1', clienteNome: 'Cliente Um', resumo: 'Resumo pro admin.' },
    ]);
    expect(prisma.vendedor.findFirst).not.toHaveBeenCalled();
  });

  it('busca os clientes da carteira do vendedor ORIGINAL, nao do substituto', async () => {
    const prisma = prismaFake({ clientes: [] });
    const service = new CoberturaResumoService(
      prisma as never,
      llmClientServiceFake({}) as never,
      redisFake() as never,
    );

    await service.obterResumo('cob-1', IDP_USER, 'u1');

    expect(prisma.cliente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { vendedores: { some: { vendedorId: 'v-original' } } },
      }),
    );
  });

  it('resumo do cliente fica null (sem derrubar a lista) quando a chamada a IA falha', async () => {
    const prisma = prismaFake({
      clientes: [{ id: 'c1', razaoSocial: 'Cliente Um', nomeFantasia: null }],
    });
    const service = new CoberturaResumoService(
      prisma as never,
      llmClientServiceFake({ erro: new Error('sem chave configurada') }) as never,
      redisFake() as never,
    );

    const resultado = await service.obterResumo('cob-1', IDP_USER, 'u1');

    expect(resultado.clientes).toEqual([{ clienteId: 'c1', clienteNome: 'Cliente Um', resumo: null }]);
  });

  it('usa o resumo cacheado no Redis sem chamar a IA de novo', async () => {
    const prisma = prismaFake({
      clientes: [{ id: 'c1', razaoSocial: 'Cliente Um', nomeFantasia: null }],
    });
    const llmClientService = llmClientServiceFake({});
    const service = new CoberturaResumoService(
      prisma as never,
      llmClientService as never,
      redisFake('Resumo ja cacheado.') as never,
    );

    const resultado = await service.obterResumo('cob-1', IDP_USER, 'u1');

    expect(resultado.clientes[0].resumo).toBe('Resumo ja cacheado.');
    expect(llmClientService.gerarJson).not.toHaveBeenCalled();
  });
});
