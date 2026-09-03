import { OportunidadeClienteService } from './oportunidade-cliente.service';

function prismaFake(overrides: {
  clientes?: Record<string, unknown>[];
  pedidos?: Record<string, unknown>[];
}) {
  return {
    cliente: {
      findMany: jest.fn().mockResolvedValue(overrides.clientes ?? []),
    },
    pedido: {
      findMany: jest.fn().mockResolvedValue(overrides.pedidos ?? []),
    },
  };
}

function llmClientServiceFake(overrides: {
  contexto?: string;
  erro?: Error;
}) {
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

const HOJE = new Date('2026-06-01T00:00:00.000Z');

describe('OportunidadeClienteService.listarParaVendedor', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(HOJE);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('retorna lista vazia sem consultar pedidos quando o vendedor nao tem clientes', async () => {
    const prisma = prismaFake({ clientes: [] });
    const service = new OportunidadeClienteService(
      prisma as never,
      llmClientServiceFake({}) as never,
      redisFake() as never,
    );

    const resultado = await service.listarParaVendedor('v1');

    expect(resultado).toEqual([]);
    expect(prisma.pedido.findMany).not.toHaveBeenCalled();
  });

  it('ignora cliente sem nenhum pedido (sem historico, sem oportunidade)', async () => {
    const prisma = prismaFake({
      clientes: [{ id: 'c1', razaoSocial: 'Cliente Sem Pedido', nomeFantasia: null }],
      pedidos: [],
    });
    const service = new OportunidadeClienteService(
      prisma as never,
      llmClientServiceFake({}) as never,
      redisFake() as never,
    );

    const resultado = await service.listarParaVendedor('v1');

    expect(resultado).toEqual([]);
  });

  it('inclui cliente sem pedido ha muitos dias, com contexto gerado pela IA', async () => {
    const prisma = prismaFake({
      clientes: [{ id: 'c1', razaoSocial: 'Cliente Antigo', nomeFantasia: null }],
      pedidos: [
        {
          clienteId: 'c1',
          dataHoraUltimaAlteracao: new Date('2026-01-01'),
          itens: [],
        },
      ],
    });
    const service = new OportunidadeClienteService(
      prisma as never,
      llmClientServiceFake({ contexto: 'Cliente sumido ha tempos.' }) as never,
      redisFake() as never,
    );

    const resultado = await service.listarParaVendedor('v1', 45);

    expect(resultado).toEqual([
      {
        clienteId: 'c1',
        clienteNome: 'Cliente Antigo',
        motivo: { tipo: 'SEM_PEDIDO_HA_DIAS', dias: 151 },
        ultimaInteracaoEm: new Date('2026-01-01').toISOString(),
        contexto: 'Cliente sumido ha tempos.',
      },
    ]);
  });

  it('contexto fica null (sem derrubar a lista) quando a chamada a IA falha', async () => {
    const prisma = prismaFake({
      clientes: [{ id: 'c1', razaoSocial: 'Cliente Antigo', nomeFantasia: null }],
      pedidos: [
        {
          clienteId: 'c1',
          dataHoraUltimaAlteracao: new Date('2026-01-01'),
          itens: [],
        },
      ],
    });
    const service = new OportunidadeClienteService(
      prisma as never,
      llmClientServiceFake({ erro: new Error('sem chave configurada') }) as never,
      redisFake() as never,
    );

    const resultado = await service.listarParaVendedor('v1', 45);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].contexto).toBeNull();
    expect(resultado[0].motivo).toEqual({ tipo: 'SEM_PEDIDO_HA_DIAS', dias: 151 });
  });

  it('usa o contexto cacheado no Redis sem chamar a IA de novo', async () => {
    const prisma = prismaFake({
      clientes: [{ id: 'c1', razaoSocial: 'Cliente Antigo', nomeFantasia: null }],
      pedidos: [
        {
          clienteId: 'c1',
          dataHoraUltimaAlteracao: new Date('2026-01-01'),
          itens: [],
        },
      ],
    });
    const llmClientService = llmClientServiceFake({});
    const service = new OportunidadeClienteService(
      prisma as never,
      llmClientService as never,
      redisFake('Contexto ja cacheado.') as never,
    );

    const resultado = await service.listarParaVendedor('v1', 45);

    expect(resultado[0].contexto).toBe('Contexto ja cacheado.');
    expect(llmClientService.gerarJson).not.toHaveBeenCalled();
  });

  it('cliente com pedido recente e sem outro motivo nao entra na lista', async () => {
    const prisma = prismaFake({
      clientes: [{ id: 'c1', razaoSocial: 'Cliente Ativo', nomeFantasia: null }],
      pedidos: [
        {
          clienteId: 'c1',
          dataHoraUltimaAlteracao: new Date('2026-05-30'),
          itens: [],
        },
      ],
    });
    const service = new OportunidadeClienteService(
      prisma as never,
      llmClientServiceFake({}) as never,
      redisFake() as never,
    );

    const resultado = await service.listarParaVendedor('v1', 45);

    expect(resultado).toEqual([]);
  });
});
