import { NotFoundException } from '@nestjs/common';
import { MetaVendedorService } from './meta-vendedor.service';
import { VendedorVendasService } from '../vendedores/vendedor-vendas.service';

function decimalFake(valor: number) {
  return { toNumber: () => valor };
}

function prismaFake(overrides: {
  vendedor?: unknown;
  metaExistente?: unknown;
}) {
  return {
    vendedor: {
      findUnique: jest.fn().mockResolvedValue(overrides.vendedor ?? null),
    },
    metaVendedor: {
      upsert: jest.fn().mockImplementation(async ({ create, update }) => ({
        vendedorId: create.vendedorId,
        mesAno: create.mesAno,
        valorMeta: decimalFake(update.valorMeta ?? create.valorMeta),
        atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
      })),
      findUnique: jest.fn().mockResolvedValue(overrides.metaExistente ?? null),
    },
  };
}

function vendedorVendasServiceFake(valores: Record<string, number> = {}) {
  return {
    valorVendidoPorVendedor: jest.fn().mockResolvedValue(new Map(Object.entries(valores))),
  } as unknown as VendedorVendasService;
}

describe('MetaVendedorService.definir', () => {
  it('lanca NotFoundException quando o vendedor nao existe', async () => {
    const prisma = prismaFake({});
    const service = new MetaVendedorService(prisma as never, vendedorVendasServiceFake());

    await expect(
      service.definir('inexistente', { mesAno: '2026-01', valorMeta: 1000 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('cria/atualiza a meta do vendedor pro mes informado', async () => {
    const prisma = prismaFake({ vendedor: { id: 'v1' } });
    const service = new MetaVendedorService(prisma as never, vendedorVendasServiceFake());

    const resultado = await service.definir('v1', { mesAno: '2026-01', valorMeta: 5000 });

    expect(resultado).toEqual({
      vendedorId: 'v1',
      mesAno: '2026-01',
      valorMeta: 5000,
      atualizadoEm: '2026-01-01T00:00:00.000Z',
    });
  });
});

describe('MetaVendedorService.obterProgresso', () => {
  it('percentualAtingido fica null quando nao ha meta configurada pro mes (nao e "meta zero")', async () => {
    const prisma = prismaFake({ metaExistente: null });
    const service = new MetaVendedorService(
      prisma as never,
      vendedorVendasServiceFake({ v1: 1500 }),
    );

    const resultado = await service.obterProgresso('v1', '2026-01');

    expect(resultado).toEqual({
      vendedorId: 'v1',
      mesAno: '2026-01',
      valorMeta: null,
      valorVendido: 1500,
      percentualAtingido: null,
    });
  });

  it('calcula percentualAtingido corretamente quando ha meta e venda no mes', async () => {
    const prisma = prismaFake({
      metaExistente: { valorMeta: decimalFake(1000) },
    });
    const service = new MetaVendedorService(
      prisma as never,
      vendedorVendasServiceFake({ v1: 750 }),
    );

    const resultado = await service.obterProgresso('v1', '2026-01');

    expect(resultado.valorMeta).toBe(1000);
    expect(resultado.valorVendido).toBe(750);
    expect(resultado.percentualAtingido).toBe(75);
  });

  it('valorVendido fica 0 quando o vendedor nao aparece no mapa de vendas do periodo', async () => {
    const prisma = prismaFake({ metaExistente: { valorMeta: decimalFake(1000) } });
    const service = new MetaVendedorService(prisma as never, vendedorVendasServiceFake({}));

    const resultado = await service.obterProgresso('v1', '2026-01');

    expect(resultado.valorVendido).toBe(0);
    expect(resultado.percentualAtingido).toBe(0);
  });
});
