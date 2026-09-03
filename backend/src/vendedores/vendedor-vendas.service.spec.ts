import { VendedorVendasService } from './vendedor-vendas.service';

function prismaFake(overrides: {
  pedidoGroupBy?: unknown[];
  vinculos?: unknown[];
}) {
  return {
    pedido: {
      groupBy: jest.fn().mockResolvedValue(overrides.pedidoGroupBy ?? []),
    },
    clienteVendedor: {
      findMany: jest.fn().mockResolvedValue(overrides.vinculos ?? []),
    },
  };
}

describe('VendedorVendasService.valorVendidoPorVendedor', () => {
  it('retorna mapa vazio sem consultar vinculos quando nao ha pedido no periodo', async () => {
    const prisma = prismaFake({ pedidoGroupBy: [] });
    const service = new VendedorVendasService(prisma as never);

    const resultado = await service.valorVendidoPorVendedor({});

    expect(resultado.size).toBe(0);
    expect(prisma.clienteVendedor.findMany).not.toHaveBeenCalled();
  });

  it('soma o valor de todos os clientes vinculados a um vendedor', async () => {
    const prisma = prismaFake({
      pedidoGroupBy: [
        { clienteId: 'c1', _sum: { valorTotal: { toString: () => '500' } } },
        { clienteId: 'c2', _sum: { valorTotal: { toString: () => '300' } } },
      ],
      vinculos: [
        { clienteId: 'c1', vendedorId: 'v1' },
        { clienteId: 'c2', vendedorId: 'v1' },
      ],
    });
    const service = new VendedorVendasService(prisma as never);

    const resultado = await service.valorVendidoPorVendedor({});

    expect(resultado.get('v1')).toBe(800);
  });

  it('cliente sem vinculo de vendedor nao contribui pra nenhum vendedor', async () => {
    const prisma = prismaFake({
      pedidoGroupBy: [{ clienteId: 'c1', _sum: { valorTotal: { toString: () => '500' } } }],
      vinculos: [],
    });
    const service = new VendedorVendasService(prisma as never);

    const resultado = await service.valorVendidoPorVendedor({});

    expect(resultado.size).toBe(0);
  });

  it('usa o primeiro vinculo (mais antigo) quando ha mais de um vendedor por cliente', async () => {
    const prisma = prismaFake({
      pedidoGroupBy: [{ clienteId: 'c1', _sum: { valorTotal: { toString: () => '500' } } }],
      vinculos: [
        { clienteId: 'c1', vendedorId: 'v-antigo' },
        { clienteId: 'c1', vendedorId: 'v-novo' },
      ],
    });
    const service = new VendedorVendasService(prisma as never);

    const resultado = await service.valorVendidoPorVendedor({});

    expect(resultado.get('v-antigo')).toBe(500);
    expect(resultado.has('v-novo')).toBe(false);
  });
});
