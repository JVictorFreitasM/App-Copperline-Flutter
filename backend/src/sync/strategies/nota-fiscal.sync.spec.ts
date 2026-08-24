import { NotaFiscalSyncStrategy } from './nota-fiscal.sync';
import type { WkRadarNotaFiscal } from './nota-fiscal.types';

describe('NotaFiscalSyncStrategy.map', () => {
  const configServiceFake = { get: () => undefined } as never;
  const strategy = new NotaFiscalSyncStrategy(
    undefined as never,
    undefined as never,
    configServiceFake,
  );

  it('mapeia os campos-chave, traduz os enums e usa null para ausentes', () => {
    const bruto: WkRadarNotaFiscal = {
      id: '321',
      codigoIntegrador: null,
      chave: '35260812345678000199550010000001231234567890',
      tipo: 'Saida',
      numero: 123,
      serie: '1',
      dataEmissao: '2026-08-15T10:00:00',
      pedidos: [{ id: 'pedido-1' }, { id: 'pedido-2' }, { id: null }],
      nfe: { status: 'Autorizada' },
      nfse: { nfseGerada: false, nfseCancelada: false },
      total: { valorTotalNotaFiscal: 500 },
    };

    const mapeado = strategy.map(bruto);

    expect(mapeado).toEqual({
      idExternoErp: '321',
      codigoIntegrador: null,
      chave: '35260812345678000199550010000001231234567890',
      tipo: 'SAIDA',
      numero: 123,
      serie: '1',
      dataEmissao: new Date('2026-08-15T10:00:00'),
      statusNfe: 'AUTORIZADA',
      nfseGerada: false,
      nfseCancelada: false,
      valorTotalNotaFiscal: 500,
      pedidosExternoIds: ['pedido-1', 'pedido-2'],
    });
  });
});

describe('NotaFiscalSyncStrategy.fetch', () => {
  it('ignora janela.desde (cursor incremental) e sempre reprocessa os ultimos 60 dias a partir de janela.ate', async () => {
    const get = jest.fn().mockResolvedValue([]);
    const erpClientFake = { get } as never;
    // Janela de 30 dias configurada de uma vez so (nao fatiada), pra
    // deixar claro na asserção qual foi o range total efetivamente usado.
    const configServiceFake = { get: () => 60 * 24 * 60 * 60 * 1000 } as never;

    const strategy = new NotaFiscalSyncStrategy(
      erpClientFake,
      undefined as never,
      configServiceFake,
    );

    // janela.desde deliberadamente MUITO diferente do que deveria ser
    // usado (1 dia atras) - se a strategy respeitasse o cursor incremental
    // normal, so buscaria 1 dia; o teste confirma que ela ignora isso e
    // usa 60 dias a partir de janela.ate.
    const agora = new Date('2026-08-18T03:15:00Z');
    const umDiaAtras = new Date('2026-08-17T03:15:00Z');

    await strategy.fetch({ desde: umDiaAtras, ate: agora });

    expect(get).toHaveBeenCalledTimes(1);
    const chamada = get.mock.calls[0] as [
      string,
      { DataEmissaoInicial: string; DataEmissaoFinal: string },
    ];
    const paramsUsados = chamada[1];

    // DataEmissaoInicial/Final sao "date" (YYYY-MM-DD, sem hora - ver
    // nota-fiscal.sync.ts). 60 dias antes de 2026-08-18 e 2026-06-19.
    expect(paramsUsados.DataEmissaoInicial).toBe('2026-06-19');
    expect(paramsUsados.DataEmissaoFinal).toBe('2026-08-18');
  });
});

function prismaFake(notaExistente: { statusNfe: string | null } | null) {
  const tx = {
    notaFiscal: {
      findUnique: jest.fn().mockResolvedValue(notaExistente),
      upsert: jest.fn().mockImplementation(({ create }) => ({ id: 'nota-1', ...create })),
    },
    notaFiscalPedido: {
      deleteMany: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue(undefined),
    },
    pedido: { upsert: jest.fn().mockResolvedValue({ id: 'pedido-1', incompleto: false }) },
    eventoNotificacao: { create: jest.fn().mockResolvedValue(undefined) },
  };
  return {
    tx,
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
  };
}

const MAPEADO_BASE = {
  idExternoErp: '321',
  codigoIntegrador: null,
  chave: null,
  tipo: null,
  numero: 123,
  serie: '1',
  dataEmissao: new Date(),
  statusNfe: 'REJEITADA' as const,
  nfseGerada: null,
  nfseCancelada: null,
  valorTotalNotaFiscal: null,
  pedidosExternoIds: [],
};

describe('NotaFiscalSyncStrategy.upsert (OS-BACKEND-19, alerta de nota rejeitada)', () => {
  const configServiceFake = { get: () => undefined } as never;

  it('registra evento quando o status ENTRA em REJEITADA', async () => {
    const prisma = prismaFake({ statusNfe: 'AGUARDANDO_AUTORIZACAO' });
    const strategy = new NotaFiscalSyncStrategy(
      undefined as never,
      prisma as never,
      configServiceFake,
    );

    await strategy.upsert(MAPEADO_BASE);

    expect(prisma.tx.eventoNotificacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: 'NOTA_FISCAL_REJEITADA',
          referenciaId: 'nota-1',
        }),
      }),
    );
  });

  it('nao registra evento se ja estava rejeitada antes (nao duplica em re-sync)', async () => {
    const prisma = prismaFake({ statusNfe: 'REJEITADA' });
    const strategy = new NotaFiscalSyncStrategy(
      undefined as never,
      prisma as never,
      configServiceFake,
    );

    await strategy.upsert(MAPEADO_BASE);

    expect(prisma.tx.eventoNotificacao.create).not.toHaveBeenCalled();
  });

  it('nao registra evento se o novo status nao e REJEITADA', async () => {
    const prisma = prismaFake({ statusNfe: 'AGUARDANDO_AUTORIZACAO' });
    const strategy = new NotaFiscalSyncStrategy(
      undefined as never,
      prisma as never,
      configServiceFake,
    );

    await strategy.upsert({ ...MAPEADO_BASE, statusNfe: 'AUTORIZADA' });

    expect(prisma.tx.eventoNotificacao.create).not.toHaveBeenCalled();
  });

  it('nao registra evento na primeira sincronizacao (nota nova)', async () => {
    const prisma = prismaFake(null);
    const strategy = new NotaFiscalSyncStrategy(
      undefined as never,
      prisma as never,
      configServiceFake,
    );

    await strategy.upsert(MAPEADO_BASE);

    expect(prisma.tx.eventoNotificacao.create).not.toHaveBeenCalled();
  });
});
