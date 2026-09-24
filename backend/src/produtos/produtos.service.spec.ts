import { NotFoundException } from '@nestjs/common';
import { ProdutosService } from './produtos.service';

function prismaFake(overrides: {
  findMany?: unknown[];
  count?: number;
  findUnique?: unknown;
}) {
  return {
    produto: {
      findMany: jest.fn().mockResolvedValue(overrides.findMany ?? []),
      count: jest.fn().mockResolvedValue(overrides.count ?? 0),
      findUnique: jest.fn().mockResolvedValue(overrides.findUnique ?? null),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

function precoProdutoServiceFake(overrides: {
  precosTabela?: Map<string, string>;
  precoPorCodigo?: string | null;
} = {}) {
  return {
    obterPrecosDaTabelaPadrao: jest.fn().mockResolvedValue(overrides.precosTabela ?? new Map()),
    obterPrecoPorCodigo: jest.fn().mockResolvedValue(overrides.precoPorCodigo ?? null),
  };
}

describe('ProdutosService.listar', () => {
  it('mapeia precoVenda (Decimal, por km) sem conversao, quando nao ha tabela padrao', async () => {
    const produtoBruto = {
      id: '1',
      idExternoErp: 'ext-1',
      codigo: 'PROD-1',
      nome: 'Produto A',
      tipo: 'PROPRIO',
      inativo: false,
      precoVenda: { toString: () => '19.9900' },
      gtin: null,
      incompleto: false,
      sincronizadoEm: new Date('2026-01-01'),
    };
    const prisma = prismaFake({ findMany: [produtoBruto], count: 1 });
    const service = new ProdutosService(prisma as never, precoProdutoServiceFake() as never);

    const resultado = await service.listar({ page: 1, limit: 20 });

    // precoVenda vem por KM (ver produto-response.dto.ts) - exibido cru,
    // sem conversao (achado 2026-09-23: dividir aqui mostrava 1/1000 do
    // preco real na tela de produto - as telas de tabela de preco ja
    // exibiam o valor cru corretamente).
    expect(resultado.data[0].precoVenda).toBe('19.9900');
  });

  it('usa o preco da tabela padrao no lugar do precoVenda cru, sem conversao (preco de tabela ja vem por km)', async () => {
    const produtoBruto = {
      id: '1',
      idExternoErp: 'ext-1',
      codigo: 'PROD-1',
      nome: 'Produto A',
      tipo: 'PROPRIO',
      inativo: false,
      precoVenda: { toString: () => '19.9900' },
      gtin: null,
      incompleto: false,
      sincronizadoEm: new Date('2026-01-01'),
    };
    const prisma = prismaFake({ findMany: [produtoBruto], count: 1 });
    const precoProdutoService = precoProdutoServiceFake({
      precosTabela: new Map([['PROD-1', '2600.02']]),
    });
    const service = new ProdutosService(prisma as never, precoProdutoService as never);

    const resultado = await service.listar({ page: 1, limit: 20 });

    expect(resultado.data[0].precoVenda).toBe('2600.02');
  });

  it('filtra por gtin quando informado', async () => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new ProdutosService(prisma as never, precoProdutoServiceFake() as never);

    await service.listar({ page: 1, limit: 20, gtin: '789123' });

    expect(prisma.produto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gtin: { contains: '789123', mode: 'insensitive' } },
      }),
    );
  });
});

describe('ProdutosService.buscarPorId', () => {
  it('lança NotFoundException quando o produto nao existe', async () => {
    const prisma = prismaFake({ findUnique: null });
    const service = new ProdutosService(prisma as never, precoProdutoServiceFake() as never);

    await expect(service.buscarPorId('inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('usa o preco da tabela padrao no lugar do precoVenda cru, sem conversao, quando existe', async () => {
    const produtoBruto = {
      id: '1',
      idExternoErp: 'ext-1',
      codigo: 'PROD-1',
      nome: 'Produto A',
      tipo: 'PROPRIO',
      inativo: false,
      precoVenda: { toString: () => '19.9900' },
      gtin: null,
      incompleto: false,
      sincronizadoEm: new Date('2026-01-01'),
      idGrade1: null,
      idGrade2: null,
      idGrade3: null,
      referenciasGrade: [],
      tipoVenda: null,
      comprimentoMetros: null,
      precoFabricacao: null,
      imagemCaminho: null,
    };
    const prisma = prismaFake({ findUnique: produtoBruto });
    const precoProdutoService = precoProdutoServiceFake({ precoPorCodigo: '2600.02' });
    const service = new ProdutosService(prisma as never, precoProdutoService as never);

    const resultado = await service.buscarPorId('1');

    expect(precoProdutoService.obterPrecoPorCodigo).toHaveBeenCalledWith('PROD-1');
    expect(resultado.precoVenda).toBe('2600.02');
  });
});
