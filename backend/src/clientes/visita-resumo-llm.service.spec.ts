import { NotFoundException } from '@nestjs/common';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';
import { VisitaResumoLlmService } from './visita-resumo-llm.service';

const ESCOPO_TODOS: EscopoClientes = { tipo: 'TODOS' };

function prismaFake(overrides: { cliente?: unknown } = {}) {
  return {
    cliente: {
      findFirst: jest
        .fn()
        .mockResolvedValue('cliente' in overrides ? overrides.cliente : { id: 'c1' }),
    },
  };
}

function visitasServiceFake(visitas: unknown[] = []) {
  return { listarPorCliente: jest.fn().mockResolvedValue(visitas) };
}

function llmClientServiceFake(resultado: {
  resumo: string;
  pontosDeAtencao: string[];
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

describe('VisitaResumoLlmService.obterResumo', () => {
  it('lanca NotFoundException quando o cliente nao existe', async () => {
    const service = new VisitaResumoLlmService(
      prismaFake({ cliente: null }) as never,
      visitasServiceFake() as never,
      llmClientServiceFake({ resumo: '', pontosDeAtencao: [], dadosInsuficientes: true }) as never,
      redisFake() as never,
    );

    await expect(service.obterResumo('inexistente', ESCOPO_TODOS)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('retorna do cache quando ja existe, sem chamar o LLM de novo', async () => {
    const resumoCacheado = {
      clienteId: 'c1',
      geradoEm: '2026-01-01T00:00:00.000Z',
      resumo: 'resumo cacheado',
      pontosDeAtencao: ['ponto 1'],
      dadosInsuficientes: false,
      quantidadeNotasConsideradas: 3,
      fonteCache: false,
    };
    const llmClient = llmClientServiceFake({
      resumo: '',
      pontosDeAtencao: [],
      dadosInsuficientes: true,
    });
    const service = new VisitaResumoLlmService(
      prismaFake() as never,
      visitasServiceFake() as never,
      llmClient as never,
      redisFake({ valorCacheado: JSON.stringify(resumoCacheado) }) as never,
    );

    const resultado = await service.obterResumo('c1', ESCOPO_TODOS);

    expect(llmClient.gerarJson).not.toHaveBeenCalled();
    expect(resultado.fonteCache).toBe(true);
    expect(resultado.resumo).toBe('resumo cacheado');
  });

  it('gera via LLM usando so as visitas com nota, cacheia por 24h e retorna fonteCache:false', async () => {
    const llmClient = llmClientServiceFake({
      resumo: 'cliente mencionou interesse em novo produto',
      pontosDeAtencao: ['perguntar sobre o novo produto'],
      dadosInsuficientes: false,
    });
    const redis = redisFake();
    const visitas = [
      { checkinEm: '2026-01-10T00:00:00.000Z', nota: 'segunda nota' },
      { checkinEm: '2026-01-01T00:00:00.000Z', nota: null },
      { checkinEm: '2026-01-05T00:00:00.000Z', nota: 'primeira nota' },
    ];
    const visitasService = visitasServiceFake(visitas);
    const service = new VisitaResumoLlmService(
      prismaFake() as never,
      visitasService as never,
      llmClient as never,
      redis as never,
    );

    const resultado = await service.obterResumo('c1', ESCOPO_TODOS);

    // So as 2 visitas com nota preenchida entram - a com nota null e'
    // descartada antes de chamar o LLM.
    expect(resultado.quantidadeNotasConsideradas).toBe(2);
    expect(resultado.fonteCache).toBe(false);
    expect(resultado.resumo).toBe('cliente mencionou interesse em novo produto');
    expect(redis.set).toHaveBeenCalledWith(
      'cache:resumo-visitas-cliente:c1',
      expect.any(String),
      'EX',
      24 * 60 * 60,
    );
  });

  it('propaga o erro do LlmClientService sem inventar um resumo alternativo', async () => {
    const llmClient = { gerarJson: jest.fn().mockRejectedValue(new Error('sem chave configurada')) };
    const service = new VisitaResumoLlmService(
      prismaFake() as never,
      visitasServiceFake() as never,
      llmClient as never,
      redisFake() as never,
    );

    await expect(service.obterResumo('c1', ESCOPO_TODOS)).rejects.toThrow(
      'sem chave configurada',
    );
  });

  it('lanca NotFoundException sem consultar o banco quando o escopo e NENHUM', async () => {
    const prisma = prismaFake();
    const service = new VisitaResumoLlmService(
      prisma as never,
      visitasServiceFake() as never,
      llmClientServiceFake({ resumo: '', pontosDeAtencao: [], dadosInsuficientes: true }) as never,
      redisFake() as never,
    );

    await expect(service.obterResumo('c1', { tipo: 'NENHUM' })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
  });
});
