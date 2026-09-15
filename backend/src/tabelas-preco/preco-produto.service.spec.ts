import { PrecoProdutoService } from './preco-produto.service';

function decimalFake(valor: string) {
  return { toString: () => valor };
}

function configuracaoTabelaPrecoServiceFake(codigoSelecionado: string | null) {
  return { obterCodigoSelecionado: jest.fn().mockResolvedValue(codigoSelecionado) };
}

function prismaFake(overrides: {
  tabela?: { id: string } | null;
  itens?: unknown[];
  item?: unknown;
  tabelasAtivas?: { id: string; codigo: string }[];
} = {}) {
  return {
    tabelaPreco: {
      findUnique: jest.fn().mockResolvedValue(overrides.tabela === undefined ? { id: 't1' } : overrides.tabela),
      findMany: jest.fn().mockResolvedValue(overrides.tabelasAtivas ?? []),
    },
    itemTabelaPreco: {
      findMany: jest.fn().mockResolvedValue(overrides.itens ?? []),
      findUnique: jest.fn().mockResolvedValue(overrides.item ?? null),
    },
  };
}

describe('PrecoProdutoService.obterPrecosDaTabelaPadrao', () => {
  it('retorna mapa vazio quando nenhum codigo foi selecionado ainda', async () => {
    const prisma = prismaFake();
    const service = new PrecoProdutoService(
      prisma as never,
      configuracaoTabelaPrecoServiceFake(null) as never,
    );

    const resultado = await service.obterPrecosDaTabelaPadrao();

    expect(resultado.size).toBe(0);
    expect(prisma.tabelaPreco.findUnique).not.toHaveBeenCalled();
  });

  it('retorna mapa vazio quando o codigo selecionado ainda nao terminou de sincronizar', async () => {
    const prisma = prismaFake({ tabela: null });
    const service = new PrecoProdutoService(
      prisma as never,
      configuracaoTabelaPrecoServiceFake('110') as never,
    );

    const resultado = await service.obterPrecosDaTabelaPadrao();

    expect(resultado.size).toBe(0);
  });

  it('monta o mapa codigoItem -> preco da tabela selecionada', async () => {
    const prisma = prismaFake({
      tabela: { id: 't1' },
      itens: [{ codigoItem: '50191', preco: decimalFake('2600.02') }],
    });
    const service = new PrecoProdutoService(
      prisma as never,
      configuracaoTabelaPrecoServiceFake('110') as never,
    );

    const resultado = await service.obterPrecosDaTabelaPadrao();

    expect(resultado.get('50191')).toBe('2600.02');
    expect(prisma.tabelaPreco.findUnique).toHaveBeenCalledWith({
      where: { codigo: '110' },
      select: { id: true },
    });
  });
});

describe('PrecoProdutoService.obterPrecoPorCodigo', () => {
  it('retorna null quando nenhum codigo foi selecionado ainda', async () => {
    const prisma = prismaFake();
    const service = new PrecoProdutoService(
      prisma as never,
      configuracaoTabelaPrecoServiceFake(null) as never,
    );

    expect(await service.obterPrecoPorCodigo('50191')).toBeNull();
  });

  it('retorna o preco quando existe item pro codigo na tabela selecionada', async () => {
    const prisma = prismaFake({ item: { preco: decimalFake('2600.02') } });
    const service = new PrecoProdutoService(
      prisma as never,
      configuracaoTabelaPrecoServiceFake('110') as never,
    );

    expect(await service.obterPrecoPorCodigo('50191')).toBe('2600.02');
  });
});

// OS-novas-implementacoes.md Bloco 1
describe('PrecoProdutoService.obterPrecoPorCodigoDeTabela', () => {
  it('retorna null quando a tabela informada nao existe/nao foi sincronizada', async () => {
    const prisma = prismaFake({ tabela: null });
    const service = new PrecoProdutoService(
      prisma as never,
      configuracaoTabelaPrecoServiceFake(null) as never,
    );

    expect(await service.obterPrecoPorCodigoDeTabela('205', '50191')).toBeNull();
  });

  it('retorna null quando a tabela existe mas o produto nao tem item NELA (nao cai pra outra fonte)', async () => {
    const prisma = prismaFake({ tabela: { id: 't1' }, item: null });
    const service = new PrecoProdutoService(
      prisma as never,
      configuracaoTabelaPrecoServiceFake(null) as never,
    );

    expect(await service.obterPrecoPorCodigoDeTabela('205', '50191')).toBeNull();
  });

  it('retorna o preco do item NA TABELA INFORMADA', async () => {
    const prisma = prismaFake({ tabela: { id: 't1' }, item: { preco: decimalFake('80.00') } });
    const service = new PrecoProdutoService(
      prisma as never,
      configuracaoTabelaPrecoServiceFake(null) as never,
    );

    expect(await service.obterPrecoPorCodigoDeTabela('205', '50191')).toBe('80.00');
    expect(prisma.tabelaPreco.findUnique).toHaveBeenCalledWith({
      where: { codigo: '205' },
      select: { id: true },
    });
  });
});

describe('PrecoProdutoService.obterPrecosPorTabela', () => {
  it('sem restricao, compara contra toda tabela ativa', async () => {
    const prisma = prismaFake({
      tabelasAtivas: [
        { id: 't1', codigo: '110' },
        { id: 't2', codigo: '205' },
      ],
      itens: [{ tabelaPrecoId: 't1', preco: decimalFake('80.00') }],
    });
    const service = new PrecoProdutoService(
      prisma as never,
      configuracaoTabelaPrecoServiceFake(null) as never,
    );

    const resultado = await service.obterPrecosPorTabela('50191');

    expect(prisma.tabelaPreco.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ativa: true } }),
    );
    expect(resultado).toEqual([
      { codigo: '110', preco: '80.00' },
      { codigo: '205', preco: null },
    ]);
  });

  it('com restricao, so compara contra os codigos informados', async () => {
    const prisma = prismaFake({
      tabelasAtivas: [{ id: 't2', codigo: '205' }],
      itens: [],
    });
    const service = new PrecoProdutoService(
      prisma as never,
      configuracaoTabelaPrecoServiceFake(null) as never,
    );

    await service.obterPrecosPorTabela('50191', ['205']);

    expect(prisma.tabelaPreco.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ativa: true, codigo: { in: ['205'] } } }),
    );
  });
});
