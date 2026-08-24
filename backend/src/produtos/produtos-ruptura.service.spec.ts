import { ProdutosRupturaService } from './produtos-ruptura.service';

function decimalFake(valor: number) {
  return { toNumber: () => valor, toString: () => String(valor) };
}

function prismaFake(overrides: {
  consumo?: { produtoId: string; _sum: { quantidadeVenda: unknown } }[];
  produtos?: { id: string; nome: string | null; codigo: string | null }[];
  saldos?: { codigoProduto: string; quantidadeDisponivel: ReturnType<typeof decimalFake> }[];
} = {}) {
  return {
    pedidoItem: {
      groupBy: jest.fn().mockResolvedValue(overrides.consumo ?? []),
    },
    produto: {
      findMany: jest.fn().mockResolvedValue(overrides.produtos ?? []),
    },
    saldoEstoque: {
      findMany: jest.fn().mockResolvedValue(overrides.saldos ?? []),
    },
  };
}

describe('ProdutosRupturaService.calcular', () => {
  it('retorna lista vazia quando nao ha nenhum consumo no periodo', async () => {
    const service = new ProdutosRupturaService(prismaFake({ consumo: [] }) as never);

    const resultado = await service.calcular(14);

    expect(resultado).toEqual([]);
  });

  it('inclui produto com saldo baixo e consumo alto (dias ate ruptura <= alvo)', async () => {
    const prisma = prismaFake({
      consumo: [{ produtoId: 'p1', _sum: { quantidadeVenda: decimalFake(300) } }], // 300 em 30 dias = 10/dia
      produtos: [{ id: 'p1', nome: 'Produto 1', codigo: 'COD-1' }],
      saldos: [{ codigoProduto: 'COD-1', quantidadeDisponivel: decimalFake(50) }], // 50 / 10 = 5 dias
    });
    const service = new ProdutosRupturaService(prisma as never);

    const resultado = await service.calcular(14);

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      produtoId: 'p1',
      codigo: 'COD-1',
      diasAteRuptura: 5,
    });
  });

  it('NAO inclui produto com saldo baixo mas consumo alem do prazo alvo', async () => {
    const prisma = prismaFake({
      consumo: [{ produtoId: 'p1', _sum: { quantidadeVenda: decimalFake(30) } }], // 30/30 = 1/dia
      produtos: [{ id: 'p1', nome: 'Produto 1', codigo: 'COD-1' }],
      saldos: [{ codigoProduto: 'COD-1', quantidadeDisponivel: decimalFake(100) }], // 100 dias ate ruptura
    });
    const service = new ProdutosRupturaService(prisma as never);

    const resultado = await service.calcular(14);

    expect(resultado).toEqual([]);
  });

  it('NAO inclui produto sem consumo recente (indeterminado, nao e "vai zerar")', async () => {
    const prisma = prismaFake({
      consumo: [{ produtoId: 'p1', _sum: { quantidadeVenda: decimalFake(0) } }],
      produtos: [{ id: 'p1', nome: 'Produto 1', codigo: 'COD-1' }],
      saldos: [{ codigoProduto: 'COD-1', quantidadeDisponivel: decimalFake(1) }],
    });
    const service = new ProdutosRupturaService(prisma as never);

    const resultado = await service.calcular(14);

    expect(resultado).toEqual([]);
  });

  it('ignora produto sem SaldoEstoque sincronizado', async () => {
    const prisma = prismaFake({
      consumo: [{ produtoId: 'p1', _sum: { quantidadeVenda: decimalFake(300) } }],
      produtos: [{ id: 'p1', nome: 'Produto 1', codigo: 'COD-1' }],
      saldos: [],
    });
    const service = new ProdutosRupturaService(prisma as never);

    const resultado = await service.calcular(14);

    expect(resultado).toEqual([]);
  });

  it('ordena por diasAteRuptura crescente (mais urgente primeiro)', async () => {
    const prisma = prismaFake({
      consumo: [
        { produtoId: 'p1', _sum: { quantidadeVenda: decimalFake(300) } }, // 10/dia
        { produtoId: 'p2', _sum: { quantidadeVenda: decimalFake(600) } }, // 20/dia
      ],
      produtos: [
        { id: 'p1', nome: 'Produto 1', codigo: 'COD-1' },
        { id: 'p2', nome: 'Produto 2', codigo: 'COD-2' },
      ],
      saldos: [
        { codigoProduto: 'COD-1', quantidadeDisponivel: decimalFake(50) }, // 5 dias
        { codigoProduto: 'COD-2', quantidadeDisponivel: decimalFake(20) }, // 1 dia
      ],
    });
    const service = new ProdutosRupturaService(prisma as never);

    const resultado = await service.calcular(14);

    expect(resultado.map((r) => r.produtoId)).toEqual(['p2', 'p1']);
  });
});
