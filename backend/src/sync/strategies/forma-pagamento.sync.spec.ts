import { FormaPagamentoSyncStrategy } from './forma-pagamento.sync';
import type { WkRadarFormaPagamento } from './forma-pagamento.types';

function prismaFake() {
  return { formaPagamento: { upsert: jest.fn().mockResolvedValue(undefined) } };
}

describe('FormaPagamentoSyncStrategy.map', () => {
  const strategy = new FormaPagamentoSyncStrategy(undefined as never, undefined as never);

  it('mapeia os campos-chave e usa null para ausentes', () => {
    const bruto: WkRadarFormaPagamento = {
      id: '917504',
      codigoIntegrador: null,
      codigo: '06',
      descricao: 'BOLETO BANCÁRIO',
      inativa: false,
    };

    expect(strategy.map(bruto)).toEqual({
      idExternoErp: '917504',
      codigo: '06',
      descricao: 'BOLETO BANCÁRIO',
      inativa: false,
    });
  });
});

describe('FormaPagamentoSyncStrategy.fetch', () => {
  it('busca a lista inteira (Situacao=Todos), ignorando a janela recebida', async () => {
    const get = jest.fn().mockResolvedValue([{ id: '1', inativa: false }]);
    const strategy = new FormaPagamentoSyncStrategy({ get } as never, undefined as never);

    const resultado = await strategy.fetch({
      desde: new Date('2020-01-01T00:00:00Z'),
      ate: new Date('2026-01-01T00:00:00Z'),
    });

    expect(get).toHaveBeenCalledWith(
      '/empresarial/v1/forma-pagamento',
      expect.objectContaining({ Situacao: 'Todos' }),
    );
    expect(resultado.registros).toEqual([{ id: '1', inativa: false }]);
  });

  it('sinaliza aviso quando a busca retorna contagem suspeita de truncamento', async () => {
    const paginaGrande = Array.from({ length: 500 }, (_, i) => ({ id: `f${i}`, inativa: false }));
    const get = jest.fn().mockResolvedValue(paginaGrande);
    const strategy = new FormaPagamentoSyncStrategy({ get } as never, undefined as never);

    const resultado = await strategy.fetch({
      desde: new Date('2026-01-01T00:00:00Z'),
      ate: new Date('2026-01-01T00:00:00Z'),
    });

    expect(resultado.avisos).toHaveLength(1);
  });
});

describe('FormaPagamentoSyncStrategy.upsert', () => {
  it('grava inativa junto (busca Situacao=Todos, nao so as ativas)', async () => {
    const prisma = prismaFake();
    const strategy = new FormaPagamentoSyncStrategy(undefined as never, prisma as never);

    await strategy.upsert({
      idExternoErp: '917504',
      codigo: '06',
      descricao: 'BOLETO BANCÁRIO',
      inativa: true,
    });

    expect(prisma.formaPagamento.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idExternoErp: '917504' },
        create: expect.objectContaining({ inativa: true }),
        update: expect.objectContaining({ inativa: true }),
      }),
    );
  });
});
