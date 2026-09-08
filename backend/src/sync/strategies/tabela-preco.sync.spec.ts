import { TabelaPrecoSyncStrategy } from './tabela-preco.sync';
import type { TabelaPrecoBruta } from '../../empresarial-svc-client/empresarial-svc-client.types';

function empresarialSvcClientFake(tabelas: TabelaPrecoBruta[]) {
  return { buscarTabelasPreco: jest.fn().mockResolvedValue(tabelas) };
}

function prismaFake(overrides: { tabelaExistente?: { id: string } } = {}) {
  const tabelaId = overrides.tabelaExistente?.id ?? 'tabela-1';
  const tx = {
    tabelaPreco: {
      upsert: jest.fn().mockResolvedValue({ id: tabelaId }),
    },
    itemTabelaPreco: {
      upsert: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  return {
    tx,
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
  };
}

const JANELA = { desde: new Date('2026-01-01T00:00:00.000Z'), ate: new Date() };

function tabelaBrutaFake(overrides: Partial<TabelaPrecoBruta> = {}): TabelaPrecoBruta {
  return {
    Id: '58',
    Codigo: '110',
    Ativa: true,
    ItensTabelaPreco: [
      {
        CodigoItem: '50191',
        Preco: '2.600,02',
        PrecoPromocional: '0,00',
        QuantidadeMinima: '0,0000',
        QuantidadeMaxima: '99.999.999.999.999,0000',
        PercentualDescontoMaximo: '2,00',
        ValorDescontoMaximo: '0,00',
        DataUltimoReajuste: '03/11/2025 00:00',
        DataInicioPromocao: '00/00/0000 00:00',
        DataFimPromocao: '00/00/0000 00:00',
      },
    ],
    ...overrides,
  };
}

describe('TabelaPrecoSyncStrategy', () => {
  it('fetch() ignora a janela incremental (full refresh sempre)', async () => {
    const client = empresarialSvcClientFake([tabelaBrutaFake()]);
    const strategy = new TabelaPrecoSyncStrategy(client as never, prismaFake() as never);

    const resultado = await strategy.fetch(JANELA);

    expect(client.buscarTabelasPreco).toHaveBeenCalledWith();
    expect(resultado.registros).toHaveLength(1);
  });

  it('map() converte valores BR (numero e data) corretamente', () => {
    const strategy = new TabelaPrecoSyncStrategy(
      empresarialSvcClientFake([]) as never,
      prismaFake() as never,
    );

    const mapeado = strategy.map(tabelaBrutaFake());

    expect(mapeado.idExternoErp).toBe('58');
    expect(mapeado.codigo).toBe('110');
    expect(mapeado.itens[0].preco).toBe('2600.02');
    expect(mapeado.itens[0].quantidadeMaxima).toBe('99999999999999.0000');
    expect(mapeado.itens[0].dataUltimoReajuste?.toISOString()).toBe('2025-11-03T00:00:00.000Z');
    expect(mapeado.itens[0].dataInicioPromocao).toBeNull();
  });

  it('upsert() nunca toca no campo `padrao` (administrativo, nao sincronizado)', async () => {
    const prisma = prismaFake();
    const strategy = new TabelaPrecoSyncStrategy(
      empresarialSvcClientFake([]) as never,
      prisma as never,
    );
    const mapeado = strategy.map(tabelaBrutaFake());

    await strategy.upsert(mapeado);

    const chamadaUpsert = prisma.tx.tabelaPreco.upsert.mock.calls[0][0];
    expect(chamadaUpsert.create).not.toHaveProperty('padrao');
    expect(chamadaUpsert.update).not.toHaveProperty('padrao');
  });

  it('upsert() remove item que sumiu da resposta do ERP (full refresh)', async () => {
    const prisma = prismaFake({ tabelaExistente: { id: 'tabela-1' } });
    const strategy = new TabelaPrecoSyncStrategy(
      empresarialSvcClientFake([]) as never,
      prisma as never,
    );
    const mapeado = strategy.map(tabelaBrutaFake());

    await strategy.upsert(mapeado);

    expect(prisma.tx.itemTabelaPreco.deleteMany).toHaveBeenCalledWith({
      where: {
        tabelaPrecoId: 'tabela-1',
        codigoItem: { notIn: ['50191'] },
      },
    });
  });
});
