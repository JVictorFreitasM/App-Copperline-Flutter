import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ContextoAprovacaoDescontoService } from './contexto-aprovacao-desconto.service';

const IDP_USER = { sub: 's1', email: 'a@a.com', name: 'A', role: null as string | null, system: 'x' };
const IDP_USER_ADMIN = { ...IDP_USER, role: 'admin' };

function decimalFake(valor: number) {
  return { toNumber: () => valor };
}

function prismaFake(overrides: {
  solicitacao?: Record<string, unknown> | null;
  vendedorAtual?: Record<string, unknown> | null;
  vendedorSolicitante?: Record<string, unknown> | null;
  colegas?: Record<string, unknown>[];
  agregados?: Record<string, unknown>[];
}) {
  const agregados = overrides.agregados ?? [];
  let chamadaAggregate = 0;

  return {
    solicitacaoDesconto: {
      findUnique: jest.fn().mockResolvedValue(
        overrides.solicitacao === undefined
          ? {
              id: 'sol-1',
              vendedorSolicitanteId: 'v1',
              percentualSolicitado: decimalFake(30),
              aprovadorEsperadoId: 'sup1',
              pedido: null,
            }
          : overrides.solicitacao,
      ),
      aggregate: jest.fn().mockImplementation(async () => {
        const resultado = agregados[chamadaAggregate] ?? {
          _count: 0,
          _avg: { percentualSolicitado: null },
        };
        chamadaAggregate++;
        return resultado;
      }),
    },
    vendedor: {
      findFirst: jest.fn().mockResolvedValue(overrides.vendedorAtual ?? { id: 'sup1' }),
      findUnique: jest
        .fn()
        .mockResolvedValue(overrides.vendedorSolicitante ?? { supervisorId: 'sup1' }),
      findMany: jest.fn().mockResolvedValue(overrides.colegas ?? []),
    },
  };
}

function llmClientServiceFake(overrides: { contexto?: string; erro?: Error }) {
  return {
    gerarJson: jest.fn().mockImplementation(async () => {
      if (overrides.erro) throw overrides.erro;
      return { contexto: overrides.contexto ?? 'Contexto gerado pela IA.' };
    }),
  };
}

function redisFake(cacheado: string | null = null) {
  return {
    get: jest.fn().mockResolvedValue(cacheado),
    set: jest.fn().mockResolvedValue('OK'),
  };
}

describe('ContextoAprovacaoDescontoService.obterContexto', () => {
  it('lanca NotFoundException quando a solicitacao nao existe', async () => {
    const prisma = prismaFake({ solicitacao: null });
    const service = new ContextoAprovacaoDescontoService(
      prisma as never,
      llmClientServiceFake({}) as never,
      redisFake() as never,
    );

    await expect(service.obterContexto('inexistente', IDP_USER, 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lanca ForbiddenException quando quem pede nao e o aprovador esperado (evita IDOR)', async () => {
    const prisma = prismaFake({ vendedorAtual: { id: 'outro-vendedor' } });
    const service = new ContextoAprovacaoDescontoService(
      prisma as never,
      llmClientServiceFake({}) as never,
      redisFake() as never,
    );

    await expect(service.obterContexto('sol-1', IDP_USER, 'u1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('admin sempre pode consultar, mesmo sem ser o aprovador esperado', async () => {
    const prisma = prismaFake({});
    const service = new ContextoAprovacaoDescontoService(
      prisma as never,
      llmClientServiceFake({ contexto: 'Contexto pro admin.' }) as never,
      redisFake() as never,
    );

    const resultado = await service.obterContexto('sol-1', IDP_USER_ADMIN, 'u-admin');

    expect(resultado.contexto).toBe('Contexto pro admin.');
    expect(prisma.vendedor.findFirst).not.toHaveBeenCalled();
  });

  it('historicoCliente fica null quando a solicitacao nao tem pedido vinculado', async () => {
    const prisma = prismaFake({});
    const service = new ContextoAprovacaoDescontoService(
      prisma as never,
      llmClientServiceFake({}) as never,
      redisFake() as never,
    );

    const resultado = await service.obterContexto('sol-1', IDP_USER, 'u1');

    expect(resultado.historicoCliente).toBeNull();
  });

  it('mediaEquipe fica null quando o vendedor solicitante nao tem hierarquia configurada', async () => {
    const prisma = prismaFake({ vendedorSolicitante: { supervisorId: null } });
    const service = new ContextoAprovacaoDescontoService(
      prisma as never,
      llmClientServiceFake({}) as never,
      redisFake() as never,
    );

    const resultado = await service.obterContexto('sol-1', IDP_USER, 'u1');

    expect(resultado.mediaEquipe).toBeNull();
  });

  it('contexto fica null (sem derrubar os numeros) quando a chamada a IA falha', async () => {
    const prisma = prismaFake({});
    const service = new ContextoAprovacaoDescontoService(
      prisma as never,
      llmClientServiceFake({ erro: new Error('sem chave configurada') }) as never,
      redisFake() as never,
    );

    const resultado = await service.obterContexto('sol-1', IDP_USER, 'u1');

    expect(resultado.contexto).toBeNull();
    expect(resultado.historicoVendedor).toEqual({ quantidade: 0, percentualMedio: null });
  });

  it('usa o contexto cacheado no Redis sem chamar a IA de novo', async () => {
    const prisma = prismaFake({});
    const llmClientService = llmClientServiceFake({});
    const service = new ContextoAprovacaoDescontoService(
      prisma as never,
      llmClientService as never,
      redisFake('Contexto ja cacheado.') as never,
    );

    const resultado = await service.obterContexto('sol-1', IDP_USER, 'u1');

    expect(resultado.contexto).toBe('Contexto ja cacheado.');
    expect(llmClientService.gerarJson).not.toHaveBeenCalled();
  });
});
