import { NotFoundException } from '@nestjs/common';
import { SazonalidadeService } from './sazonalidade.service';

function decimalFake(valor: number) {
  return { toString: () => String(valor) };
}

function prismaFake(overrides: {
  produto?: Record<string, unknown> | null;
  itens?: Record<string, unknown>[];
}) {
  return {
    produto: {
      findUnique: jest
        .fn()
        .mockResolvedValue(overrides.produto === undefined ? { id: 'p1' } : overrides.produto),
    },
    pedidoItem: {
      findMany: jest.fn().mockResolvedValue(overrides.itens ?? []),
    },
  };
}

function llmClientServiceFake(overrides: { insight?: string; erro?: Error }) {
  return {
    gerarJson: jest.fn().mockImplementation(async () => {
      if (overrides.erro) throw overrides.erro;
      return { insight: overrides.insight ?? 'Insight gerado pela IA.' };
    }),
  };
}

function redisFake(cacheado: string | null = null) {
  return {
    get: jest.fn().mockResolvedValue(cacheado),
    set: jest.fn().mockResolvedValue('OK'),
  };
}

describe('SazonalidadeService.obter', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lanca NotFoundException quando o produto nao existe', async () => {
    const prisma = prismaFake({ produto: null });
    const service = new SazonalidadeService(
      prisma as never,
      llmClientServiceFake({}) as never,
      redisFake() as never,
    );

    await expect(service.obter('inexistente')).rejects.toThrow(NotFoundException);
  });

  it('calcula a serie mensal e o insight a partir dos pedidoItem do produto', async () => {
    const prisma = prismaFake({
      itens: [
        {
          valorTotal: decimalFake(1000),
          pedido: { dataHoraUltimaAlteracao: new Date('2026-06-05T00:00:00.000Z') },
        },
      ],
    });
    const service = new SazonalidadeService(
      prisma as never,
      llmClientServiceFake({ insight: 'Pico de vendas em junho.' }) as never,
      redisFake() as never,
    );

    const resultado = await service.obter('p1');

    expect(resultado.produtoId).toBe('p1');
    expect(resultado.serieMensal).toHaveLength(13);
    expect(resultado.serieMensal[resultado.serieMensal.length - 1]).toEqual({
      mesAno: '2026-06',
      valorVendido: 1000,
    });
    expect(resultado.insight).toBe('Pico de vendas em junho.');
  });

  it('insight fica null (sem derrubar o calculo) quando a chamada a IA falha', async () => {
    const prisma = prismaFake({ itens: [] });
    const service = new SazonalidadeService(
      prisma as never,
      llmClientServiceFake({ erro: new Error('sem chave configurada') }) as never,
      redisFake() as never,
    );

    const resultado = await service.obter('p1');

    expect(resultado.insight).toBeNull();
    expect(resultado.serieMensal).toHaveLength(13);
  });

  it('usa o insight cacheado no Redis sem chamar a IA de novo', async () => {
    const prisma = prismaFake({ itens: [] });
    const llmClientService = llmClientServiceFake({});
    const service = new SazonalidadeService(
      prisma as never,
      llmClientService as never,
      redisFake('Insight ja cacheado.') as never,
    );

    const resultado = await service.obter('p1');

    expect(resultado.insight).toBe('Insight ja cacheado.');
    expect(llmClientService.gerarJson).not.toHaveBeenCalled();
  });
});
