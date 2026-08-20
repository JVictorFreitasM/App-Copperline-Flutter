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

describe('ProdutosService.listar', () => {
  it('mapeia precoVenda (Decimal) pra string, sem perder precisao', async () => {
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
    const service = new ProdutosService(prisma as never);

    const resultado = await service.listar({ page: 1, limit: 20 });

    expect(resultado.data[0].precoVenda).toBe('19.9900');
  });

  it('filtra por gtin quando informado', async () => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new ProdutosService(prisma as never);

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
    const service = new ProdutosService(prisma as never);

    await expect(service.buscarPorId('inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });
});
