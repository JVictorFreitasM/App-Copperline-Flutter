import { CondicaoPagamentoSyncStrategy } from './condicao-pagamento.sync';
import type { WkRadarCondicaoPagamento } from './condicao-pagamento.types';

function prismaFake() {
  return { condicaoPagamento: { upsert: jest.fn().mockResolvedValue(undefined) } };
}

describe('CondicaoPagamentoSyncStrategy.map', () => {
  const strategy = new CondicaoPagamentoSyncStrategy(undefined as never, undefined as never);

  it('mapeia os campos-chave, parcelas e validade (DD/MM/AAAA)', () => {
    const bruto: WkRadarCondicaoPagamento = {
      id: '3932160',
      codigoIntegrador: null,
      codigo: '401',
      nome: '28/35/42/49/56/63-BOLETO',
      aVista: false,
      comEntrada: false,
      antecipada: false,
      validade: '31/10/2025',
      parcelas: [{ percentual: 16.66, prazo: 28, idTipoVencimento: '16384' }],
    };

    expect(strategy.map(bruto)).toEqual({
      idExternoErp: '3932160',
      codigo: '401',
      nome: '28/35/42/49/56/63-BOLETO',
      aVista: false,
      comEntrada: false,
      antecipada: false,
      validade: new Date(Date.UTC(2025, 9, 31)),
      parcelas: [{ percentual: 16.66, prazo: 28, idTipoVencimento: '16384' }],
    });
  });

  it('validade null quando o campo bruto vem ausente/null (sem expiracao)', () => {
    const mapeado = strategy.map({
      id: '245760',
      nome: 'BONIFICACAO',
      aVista: false,
      comEntrada: true,
      antecipada: false,
      validade: null,
      parcelas: [],
    });

    expect(mapeado.validade).toBeNull();
  });

  it('parcelas vira array vazio quando o bruto nao traz nenhuma', () => {
    const mapeado = strategy.map({
      id: '1',
      aVista: true,
      comEntrada: false,
      antecipada: false,
    });

    expect(mapeado.parcelas).toEqual([]);
  });
});

describe('CondicaoPagamentoSyncStrategy.fetch', () => {
  it('busca so o modulo ComercialECF, ignorando a janela recebida', async () => {
    const get = jest.fn().mockResolvedValue([{ id: '1', aVista: true }]);
    const strategy = new CondicaoPagamentoSyncStrategy({ get } as never, undefined as never);

    const resultado = await strategy.fetch({
      desde: new Date('2020-01-01T00:00:00Z'),
      ate: new Date('2026-01-01T00:00:00Z'),
    });

    expect(get).toHaveBeenCalledWith(
      '/empresarial/v1/condicao-pagamento',
      expect.objectContaining({ Modulos: 'ComercialECF' }),
    );
    expect(resultado.registros).toEqual([{ id: '1', aVista: true }]);
  });
});

describe('CondicaoPagamentoSyncStrategy.upsert', () => {
  it('grava parcelas como JSON e validade convertida', async () => {
    const prisma = prismaFake();
    const strategy = new CondicaoPagamentoSyncStrategy(undefined as never, prisma as never);

    await strategy.upsert({
      idExternoErp: '3932160',
      codigo: '401',
      nome: '28-BOLETO',
      aVista: false,
      comEntrada: false,
      antecipada: false,
      validade: new Date(Date.UTC(2025, 9, 31)),
      parcelas: [{ percentual: 100, prazo: 28, idTipoVencimento: '16384' }],
    });

    expect(prisma.condicaoPagamento.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idExternoErp: '3932160' },
        create: expect.objectContaining({
          parcelas: [{ percentual: 100, prazo: 28, idTipoVencimento: '16384' }],
          validade: new Date(Date.UTC(2025, 9, 31)),
        }),
      }),
    );
  });
});
