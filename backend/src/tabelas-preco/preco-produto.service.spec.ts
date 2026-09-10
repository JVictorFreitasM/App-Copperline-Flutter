import { PrecoProdutoService } from './preco-produto.service';

function decimalFake(valor: string) {
  return { toString: () => valor };
}

function configuracaoTabelaPrecoServiceFake(codigoSelecionado: string | null) {
  return { obterCodigoSelecionado: jest.fn().mockResolvedValue(codigoSelecionado) };
}

function prismaFake(overrides: { tabela?: { id: string } | null; itens?: unknown[]; item?: unknown } = {}) {
  return {
    tabelaPreco: {
      findUnique: jest.fn().mockResolvedValue(overrides.tabela === undefined ? { id: 't1' } : overrides.tabela),
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
