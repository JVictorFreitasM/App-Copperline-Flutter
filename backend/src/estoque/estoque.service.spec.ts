import { NotFoundException } from '@nestjs/common';
import { EstoqueService } from './estoque.service';

function prismaFake(
  produto: unknown,
  saldo: { quantidadeDisponivel: { toString(): string }; atualizadoEm: Date } | null = null,
) {
  return {
    produto: {
      findFirst: jest.fn().mockResolvedValue(produto),
    },
    saldoEstoque: {
      findUnique: jest.fn().mockResolvedValue(saldo),
    },
  };
}

function wkBiClientFake(linhas: Record<string, unknown>[] = []) {
  return {
    buscarRelatorioExportacaoAutomatica: jest.fn().mockResolvedValue(linhas),
  };
}

function configServiceFake() {
  return {
    getOrThrow: jest.fn((chave: string) => (chave === 'WK_BI_EMPRESA' ? 'teste' : '')),
  };
}

function criarService(
  prisma: unknown,
  linhasWkBi: Record<string, unknown>[] = [],
) {
  return new EstoqueService(
    prisma as never,
    wkBiClientFake(linhasWkBi) as never,
    configServiceFake() as never,
  );
}

describe('EstoqueService.consultarPorIdentificador', () => {
  it('lança NotFoundException quando o identificador não existe na tabela local', async () => {
    const prisma = prismaFake(null);
    const service = criarService(prisma);

    await expect(
      service.consultarPorIdentificador('inexistente'),
    ).rejects.toThrow(NotFoundException);
  });

  it('resolve por Id (idExternoErp) pro codigo, combina saldo disponivel (sincronizado) com lotes reais (WK BI, tempo real)', async () => {
    const produto = { id: 'uuid-1', idExternoErp: '123', codigo: 'PROD-1' };
    const prisma = prismaFake(produto, {
      quantidadeDisponivel: { toString: () => '-51321.01' },
      atualizadoEm: new Date('2026-08-21T10:00:00.000Z'),
    });
    const service = criarService(prisma, [
      {
        'Cod.': 'PROD-1',
        'Qtde Estoque': '15,4000',
        Lote: '0826-000119-3',
        'Fabricado Em': '10/08/2026',
        'Código Local': '6021',
        'Nome do Local': 'Estoque',
      },
      {
        'Cod.': 'PROD-1',
        'Qtde Estoque': '17,0000',
        Lote: '0826-000196-1',
        'Fabricado Em': '11/08/2026',
        'Código Local': '6021',
        'Nome do Local': 'Estoque',
      },
    ]);

    const resultado = await service.consultarPorIdentificador('123');

    expect(resultado.codigo).toBe('PROD-1');
    expect(resultado.itens).toHaveLength(2);
    expect(resultado.quantidadeFisicaTotal).toBe('32.4000');
    // Metricas DIFERENTES por design (ver skill wk-radar-bi-client) - saldo
    // disponivel pode ser bem menor (ou negativo) que a soma fisica dos
    // lotes quando ha pedido comprometido em aberto.
    expect(resultado.quantidadeDisponivel).toBe('-51321.01');
    expect(resultado.atualizadoEm).toBe('2026-08-21T10:00:00.000Z');
    expect(prisma.saldoEstoque.findUnique).toHaveBeenCalledWith({
      where: { codigoProduto: 'PROD-1' },
    });
  });

  it('retorna itens vazios, quantidadeFisicaTotal "0.0000" e quantidadeDisponivel/atualizadoEm null quando o produto nunca teve saldo sincronizado nem lote no WK BI', async () => {
    const prisma = prismaFake({ id: 'uuid-1', idExternoErp: '1', codigo: 'PROD-1' }, null);
    const service = criarService(prisma, []);

    const resultado = await service.consultarPorIdentificador('PROD-1');

    expect(resultado.itens).toEqual([]);
    expect(resultado.quantidadeFisicaTotal).toBe('0.0000');
    expect(resultado.quantidadeDisponivel).toBeNull();
    expect(resultado.atualizadoEm).toBeNull();
  });

  it('lança NotFoundException quando o produto local ainda não tem codigo (stub incompleto)', async () => {
    const prisma = prismaFake({ id: 'uuid-1', idExternoErp: '1', codigo: null });
    const service = criarService(prisma);

    await expect(service.consultarPorIdentificador('1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('busca os lotes pelo codigo do produto resolvido, nunca pelo identificador bruto recebido', async () => {
    const produto = { id: 'uuid-1', idExternoErp: 'algo-digitado-pelo-usuario', codigo: 'PROD-1' };
    const prisma = prismaFake(produto, null);
    const wkBiClient = wkBiClientFake([]);
    const service = new EstoqueService(
      prisma as never,
      wkBiClient as never,
      configServiceFake() as never,
    );

    await service.consultarPorIdentificador('algo-digitado-pelo-usuario');

    expect(wkBiClient.buscarRelatorioExportacaoAutomatica).toHaveBeenCalledWith(
      expect.stringContaining('"CodProdutos"="PROD-1";'),
    );
  });
});

function prismaMaisPedidosFake(overrides: {
  pedidoItemGroupBy?: unknown[];
  produtos?: unknown[];
  saldos?: unknown[];
}) {
  return {
    pedidoItem: {
      groupBy: jest.fn().mockResolvedValue(overrides.pedidoItemGroupBy ?? []),
    },
    produto: {
      findMany: jest.fn().mockResolvedValue(overrides.produtos ?? []),
    },
    saldoEstoque: {
      findMany: jest.fn().mockResolvedValue(overrides.saldos ?? []),
    },
  };
}

describe('EstoqueService.obterMaisPedidos', () => {
  it('exclui item CANCELADO do agrupamento (via where, nao pos-filtro)', async () => {
    const prisma = prismaMaisPedidosFake({});
    const service = criarService(prisma);

    await service.obterMaisPedidos(10);

    expect(prisma.pedidoItem.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ situacao: { not: 'CANCELADO' } }),
      }),
    );
  });

  it('junta quantidade pedida com saldo atual pelo codigo do produto', async () => {
    const prisma = prismaMaisPedidosFake({
      pedidoItemGroupBy: [
        { produtoId: 'p1', _sum: { quantidadeVenda: { toString: () => '150' } } },
      ],
      produtos: [{ id: 'p1', nome: 'Cabo 10mm', codigo: 'COD-1' }],
      saldos: [{ codigoProduto: 'COD-1', quantidadeDisponivel: { toString: () => '42' } }],
    });
    const service = criarService(prisma);

    const [resultado] = await service.obterMaisPedidos(10);

    expect(resultado).toEqual({
      produtoId: 'p1',
      nome: 'Cabo 10mm',
      codigo: 'COD-1',
      quantidadeTotalPedida: 150,
      quantidadeDisponivel: '42',
    });
  });

  it('produto sem saldo sincronizado retorna quantidadeDisponivel null, nao quebra', async () => {
    const prisma = prismaMaisPedidosFake({
      pedidoItemGroupBy: [
        { produtoId: 'p1', _sum: { quantidadeVenda: { toString: () => '10' } } },
      ],
      produtos: [{ id: 'p1', nome: 'Sem saldo', codigo: 'COD-2' }],
      saldos: [],
    });
    const service = criarService(prisma);

    const [resultado] = await service.obterMaisPedidos(10);

    expect(resultado.quantidadeDisponivel).toBeNull();
  });

  it('retorna lista vazia sem consultar produto/saldo quando nao ha nenhum PedidoItem', async () => {
    const prisma = prismaMaisPedidosFake({ pedidoItemGroupBy: [] });
    const service = criarService(prisma);

    const resultado = await service.obterMaisPedidos(10);

    expect(resultado).toEqual([]);
    expect(prisma.produto.findMany).not.toHaveBeenCalled();
  });
});
