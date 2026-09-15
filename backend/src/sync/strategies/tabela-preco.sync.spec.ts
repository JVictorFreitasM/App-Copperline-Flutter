import { TabelaPrecoSyncStrategy } from './tabela-preco.sync';
import type { TabelaPrecoBruta } from '../../empresarial-svc-client/empresarial-svc-client.types';

function empresarialSvcClientFake(tabelas: TabelaPrecoBruta[]) {
  return { buscarTabelasPreco: jest.fn().mockResolvedValue(tabelas) };
}

function configuracaoTabelaPrecoServiceFake(codigoSelecionado: string | null = '110') {
  return { obterCodigoSelecionado: jest.fn().mockResolvedValue(codigoSelecionado) };
}

function prismaFake(
  overrides: {
    tabelaExistente?: { id: string };
    codigosDeCliente?: { codigo: string }[];
  } = {},
) {
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
    clienteTabelaPreco: {
      findMany: jest.fn().mockResolvedValue(overrides.codigosDeCliente ?? []),
    },
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
  it('fetch() busca so o codigo selecionado (nunca todas as tabelas)', async () => {
    const client = empresarialSvcClientFake([tabelaBrutaFake()]);
    const strategy = new TabelaPrecoSyncStrategy(
      client as never,
      prismaFake() as never,
      configuracaoTabelaPrecoServiceFake('110') as never,
    );

    const resultado = await strategy.fetch(JANELA);

    expect(client.buscarTabelasPreco).toHaveBeenCalledWith('110');
    expect(resultado.registros).toHaveLength(1);
  });

  it('fetch() nao chama a API quando nenhum codigo foi selecionado ainda', async () => {
    const client = empresarialSvcClientFake([tabelaBrutaFake()]);
    const strategy = new TabelaPrecoSyncStrategy(
      client as never,
      prismaFake() as never,
      configuracaoTabelaPrecoServiceFake(null) as never,
    );

    const resultado = await strategy.fetch(JANELA);

    expect(client.buscarTabelasPreco).not.toHaveBeenCalled();
    expect(resultado.registros).toEqual([]);
    expect(resultado.avisos).toHaveLength(1);
  });

  // OS-novas-implementacoes.md Bloco 1 - alem do global, sincroniza toda
  // tabela associada a algum cliente (ClienteTabelaPreco).
  it('fetch() tambem busca codigos associados a cliente, alem do global', async () => {
    const client = empresarialSvcClientFake([tabelaBrutaFake()]);
    const prisma = prismaFake({ codigosDeCliente: [{ codigo: '205' }, { codigo: '310' }] });
    const strategy = new TabelaPrecoSyncStrategy(
      client as never,
      prisma as never,
      configuracaoTabelaPrecoServiceFake('110') as never,
    );

    await strategy.fetch(JANELA);

    expect(client.buscarTabelasPreco).toHaveBeenCalledWith('110');
    expect(client.buscarTabelasPreco).toHaveBeenCalledWith('205');
    expect(client.buscarTabelasPreco).toHaveBeenCalledWith('310');
    expect(client.buscarTabelasPreco).toHaveBeenCalledTimes(3);
  });

  it('fetch() nao duplica chamada quando o codigo global tambem esta associado a um cliente', async () => {
    const client = empresarialSvcClientFake([tabelaBrutaFake()]);
    const prisma = prismaFake({ codigosDeCliente: [{ codigo: '110' }] });
    const strategy = new TabelaPrecoSyncStrategy(
      client as never,
      prisma as never,
      configuracaoTabelaPrecoServiceFake('110') as never,
    );

    await strategy.fetch(JANELA);

    expect(client.buscarTabelasPreco).toHaveBeenCalledTimes(1);
  });

  it('fetch() sincroniza codigos de cliente mesmo sem nenhum codigo global selecionado', async () => {
    const client = empresarialSvcClientFake([tabelaBrutaFake()]);
    const prisma = prismaFake({ codigosDeCliente: [{ codigo: '205' }] });
    const strategy = new TabelaPrecoSyncStrategy(
      client as never,
      prisma as never,
      configuracaoTabelaPrecoServiceFake(null) as never,
    );

    const resultado = await strategy.fetch(JANELA);

    expect(client.buscarTabelasPreco).toHaveBeenCalledWith('205');
    expect(resultado.registros).toHaveLength(1);
  });

  it('map() converte valores BR (numero e data) corretamente', () => {
    const strategy = new TabelaPrecoSyncStrategy(
      empresarialSvcClientFake([]) as never,
      prismaFake() as never,
      configuracaoTabelaPrecoServiceFake() as never,
    );

    const mapeado = strategy.map(tabelaBrutaFake());

    expect(mapeado.idExternoErp).toBe('58');
    expect(mapeado.codigo).toBe('110');
    expect(mapeado.itens[0].preco).toBe('2600.02');
    expect(mapeado.itens[0].quantidadeMaxima).toBe('99999999999999.0000');
    expect(mapeado.itens[0].dataUltimoReajuste?.toISOString()).toBe('2025-11-03T00:00:00.000Z');
    expect(mapeado.itens[0].dataInicioPromocao).toBeNull();
  });

  it('upsert() remove item que sumiu da resposta do ERP (full refresh do codigo selecionado)', async () => {
    const prisma = prismaFake({ tabelaExistente: { id: 'tabela-1' } });
    const strategy = new TabelaPrecoSyncStrategy(
      empresarialSvcClientFake([]) as never,
      prisma as never,
      configuracaoTabelaPrecoServiceFake() as never,
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
