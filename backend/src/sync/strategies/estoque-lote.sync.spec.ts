import { EstoqueLoteSyncStrategy } from './estoque-lote.sync';

function wkBiClientFake(linhas: Record<string, unknown>[]) {
  return { buscarRelatorioExportacaoAutomatica: jest.fn().mockResolvedValue(linhas) };
}

function configServiceFake() {
  return {
    getOrThrow: jest.fn((chave: string) => (chave === 'WK_BI_EMPRESA' ? 'teste' : '')),
  };
}

function prismaFake(existentes: { id: string; lote: string; localCodigo: string }[] = []) {
  const tx = {
    estoqueLote: {
      upsert: jest.fn().mockResolvedValue(undefined),
      findMany: jest.fn().mockResolvedValue(existentes),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  return {
    tx,
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
  };
}

const JANELA = { desde: new Date('2026-01-01T00:00:00.000Z'), ate: new Date() };

describe('EstoqueLoteSyncStrategy.fetch', () => {
  it('busca com CodProdutos vazio (catalogo completo) e agrupa as linhas por Cod.', async () => {
    const wkBiClient = wkBiClientFake([
      { 'Cod.': '50039', Lote: 'L1', 'Qtde Estoque': '10,0000' },
      { 'Cod.': '50039', Lote: 'L2', 'Qtde Estoque': '5,0000' },
      { 'Cod.': '50010', Lote: 'L3', 'Qtde Estoque': '1,0000' },
    ]);
    const strategy = new EstoqueLoteSyncStrategy(
      wkBiClient as never,
      configServiceFake() as never,
      prismaFake() as never,
    );

    const resultado = await strategy.fetch(JANELA);

    expect(wkBiClient.buscarRelatorioExportacaoAutomatica).toHaveBeenCalledWith(
      expect.stringContaining('"CodProdutos"="";'),
    );
    expect(resultado.registros).toEqual([
      {
        codigoProduto: '50039',
        linhas: [
          { 'Cod.': '50039', Lote: 'L1', 'Qtde Estoque': '10,0000' },
          { 'Cod.': '50039', Lote: 'L2', 'Qtde Estoque': '5,0000' },
        ],
      },
      {
        codigoProduto: '50010',
        linhas: [{ 'Cod.': '50010', Lote: 'L3', 'Qtde Estoque': '1,0000' }],
      },
    ]);
  });

  it('ignora linha sem Cod. (defensivo, nunca visto na pratica)', async () => {
    const wkBiClient = wkBiClientFake([{ Lote: 'L1', 'Qtde Estoque': '10,0000' }]);
    const strategy = new EstoqueLoteSyncStrategy(
      wkBiClient as never,
      configServiceFake() as never,
      prismaFake() as never,
    );

    const resultado = await strategy.fetch(JANELA);

    expect(resultado.registros).toEqual([]);
  });
});

describe('EstoqueLoteSyncStrategy.map', () => {
  it('mapeia lote/local vazios pra string vazia (nunca null - ver comentario no schema) e converte quantidade/data', () => {
    const strategy = new EstoqueLoteSyncStrategy(
      wkBiClientFake([]) as never,
      configServiceFake() as never,
      prismaFake() as never,
    );

    const mapeado = strategy.map({
      codigoProduto: '50039',
      linhas: [
        {
          'Cod.': '50039',
          'Qtde Estoque': '15,4000',
          Lote: '0826-000119-3',
          'Fabricado Em': '10/08/2026',
          'Código Local': '6021',
          'Nome do Local': 'Estoque',
        },
        {
          'Cod.': '67381',
          'Qtde Estoque': '1,0000',
          Lote: '',
          'Fabricado Em': '',
          'Código Local': '6126',
          'Nome do Local': 'Material Auxiliar',
        },
      ],
    });

    expect(mapeado).toEqual({
      codigoProduto: '50039',
      itens: [
        {
          lote: '0826-000119-3',
          localCodigo: '6021',
          localNome: 'Estoque',
          quantidade: '15.4000',
          fabricadoEm: new Date('2026-08-10T00:00:00.000Z'),
        },
        {
          lote: '',
          localCodigo: '6126',
          localNome: 'Material Auxiliar',
          quantidade: '1.0000',
          fabricadoEm: null,
        },
      ],
    });
  });
});

describe('EstoqueLoteSyncStrategy.upsert', () => {
  it('upsert um item por vez pela chave composta codigoProduto+lote+localCodigo', async () => {
    const prisma = prismaFake();
    const strategy = new EstoqueLoteSyncStrategy(
      wkBiClientFake([]) as never,
      configServiceFake() as never,
      prisma as never,
    );

    await strategy.upsert({
      codigoProduto: '50039',
      itens: [
        { lote: 'L1', localCodigo: '6021', localNome: 'Estoque', quantidade: '10', fabricadoEm: null },
      ],
    });

    expect(prisma.tx.estoqueLote.upsert).toHaveBeenCalledWith({
      where: {
        codigoProduto_lote_localCodigo: {
          codigoProduto: '50039',
          lote: 'L1',
          localCodigo: '6021',
        },
      },
      create: {
        codigoProduto: '50039',
        lote: 'L1',
        localCodigo: '6021',
        localNome: 'Estoque',
        quantidade: '10',
        fabricadoEm: null,
      },
      update: {
        lote: 'L1',
        localCodigo: '6021',
        localNome: 'Estoque',
        quantidade: '10',
        fabricadoEm: null,
      },
    });
  });

  it('remove lote que sumiu da resposta pra este produto (full refresh), preserva os que ainda existem', async () => {
    const prisma = prismaFake([
      { id: 'linha-1', lote: 'L1', localCodigo: '6021' },
      { id: 'linha-obsoleta', lote: 'L2', localCodigo: '6021' },
    ]);
    const strategy = new EstoqueLoteSyncStrategy(
      wkBiClientFake([]) as never,
      configServiceFake() as never,
      prisma as never,
    );

    await strategy.upsert({
      codigoProduto: '50039',
      itens: [
        { lote: 'L1', localCodigo: '6021', localNome: 'Estoque', quantidade: '10', fabricadoEm: null },
      ],
    });

    expect(prisma.tx.estoqueLote.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['linha-obsoleta'] } },
    });
  });

  it('nao chama deleteMany quando nenhum lote antigo ficou obsoleto', async () => {
    const prisma = prismaFake([{ id: 'linha-1', lote: 'L1', localCodigo: '6021' }]);
    const strategy = new EstoqueLoteSyncStrategy(
      wkBiClientFake([]) as never,
      configServiceFake() as never,
      prisma as never,
    );

    await strategy.upsert({
      codigoProduto: '50039',
      itens: [
        { lote: 'L1', localCodigo: '6021', localNome: 'Estoque', quantidade: '10', fabricadoEm: null },
      ],
    });

    expect(prisma.tx.estoqueLote.deleteMany).not.toHaveBeenCalled();
  });
});
