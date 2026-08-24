import { NotFoundException } from '@nestjs/common';
import { ClienteResumoLlmService } from './cliente-resumo-llm.service';

function prismaFake(overrides: {
  cliente?: unknown;
  pedidos?: unknown[];
  notasFiscais?: unknown[];
  mediaValorTotal?: unknown;
} = {}) {
  return {
    cliente: {
      findUnique: jest
        .fn()
        .mockResolvedValue('cliente' in overrides ? overrides.cliente : { id: 'c1' }),
    },
    pedido: {
      findMany: jest.fn().mockResolvedValue(overrides.pedidos ?? []),
      aggregate: jest.fn().mockResolvedValue({ _avg: { valorTotal: overrides.mediaValorTotal ?? null } }),
    },
    notaFiscal: { findMany: jest.fn().mockResolvedValue(overrides.notasFiscais ?? []) },
  };
}

function llmClientServiceFake(resultado: {
  pontosDeAtencao: string[];
  sugestaoAbordagem: string;
  dadosInsuficientes: boolean;
}) {
  return { gerarJson: jest.fn().mockResolvedValue(resultado) };
}

function redisFake(overrides: { valorCacheado?: string | null } = {}) {
  return {
    get: jest.fn().mockResolvedValue(overrides.valorCacheado ?? null),
    set: jest.fn().mockResolvedValue('OK'),
  };
}

describe('ClienteResumoLlmService.obterResumo', () => {
  it('lanca NotFoundException quando o cliente nao existe', async () => {
    const service = new ClienteResumoLlmService(
      prismaFake({ cliente: null }) as never,
      llmClientServiceFake({ pontosDeAtencao: [], sugestaoAbordagem: '', dadosInsuficientes: true }) as never,
      redisFake() as never,
    );

    await expect(service.obterResumo('inexistente')).rejects.toThrow(NotFoundException);
  });

  it('retorna do cache quando ja existe, sem chamar o LLM de novo', async () => {
    const resumoCacheado = {
      clienteId: 'c1',
      geradoEm: '2026-01-01T00:00:00.000Z',
      pontosDeAtencao: ['ponto 1'],
      sugestaoAbordagem: 'abordagem',
      dadosInsuficientes: false,
      fonteCache: false,
    };
    const llmClient = llmClientServiceFake({
      pontosDeAtencao: [],
      sugestaoAbordagem: '',
      dadosInsuficientes: true,
    });
    const service = new ClienteResumoLlmService(
      prismaFake() as never,
      llmClient as never,
      redisFake({ valorCacheado: JSON.stringify(resumoCacheado) }) as never,
    );

    const resultado = await service.obterResumo('c1');

    expect(llmClient.gerarJson).not.toHaveBeenCalled();
    expect(resultado.fonteCache).toBe(true);
    expect(resultado.pontosDeAtencao).toEqual(['ponto 1']);
  });

  it('gera via LLM, cacheia por 24h e retorna fonteCache:false quando nao ha cache', async () => {
    const llmClient = llmClientServiceFake({
      pontosDeAtencao: ['cliente com nota rejeitada'],
      sugestaoAbordagem: 'perguntar sobre a nota',
      dadosInsuficientes: false,
    });
    const redis = redisFake();
    const prisma = prismaFake({
      pedidos: [{ numero: '1', situacao: 'FATURADO', valorTotal: { toString: () => '100' }, dataHoraUltimaAlteracao: new Date() }],
      notasFiscais: [{ numero: 1, statusNfe: 'REJEITADA', dataEmissao: new Date() }],
      mediaValorTotal: { toString: () => '100' },
    });
    const service = new ClienteResumoLlmService(prisma as never, llmClient as never, redis as never);

    const resultado = await service.obterResumo('c1');

    expect(resultado.fonteCache).toBe(false);
    expect(resultado.pontosDeAtencao).toEqual(['cliente com nota rejeitada']);
    expect(redis.set).toHaveBeenCalledWith(
      'cache:resumo-cliente:c1',
      expect.any(String),
      'EX',
      24 * 60 * 60,
    );
  });

  it('propaga o erro do LlmClientService sem inventar um resumo alternativo', async () => {
    const llmClient = { gerarJson: jest.fn().mockRejectedValue(new Error('sem chave configurada')) };
    const service = new ClienteResumoLlmService(
      prismaFake() as never,
      llmClient as never,
      redisFake() as never,
    );

    await expect(service.obterResumo('c1')).rejects.toThrow('sem chave configurada');
  });
});
