import { ComparativoVendedoresService } from './comparativo-vendedores.service';
import type { VendedorVendasService } from '../vendedores/vendedor-vendas.service';

function prismaFake(overrides: {
  vendedores?: unknown[];
  solicitacoesGroupBy?: unknown[];
  visitasGroupBy?: unknown[];
}) {
  return {
    vendedor: {
      findMany: jest.fn().mockResolvedValue(overrides.vendedores ?? []),
    },
    solicitacaoDesconto: {
      groupBy: jest.fn().mockResolvedValue(overrides.solicitacoesGroupBy ?? []),
    },
    visita: {
      groupBy: jest.fn().mockResolvedValue(overrides.visitasGroupBy ?? []),
    },
  };
}

describe('ComparativoVendedoresService.obter', () => {
  it('calcula ticket medio a partir de valor e quantidade de pedidos', async () => {
    const prisma = prismaFake({ vendedores: [{ id: 'v1', nome: 'Ana' }] });
    const vendedorVendasService = {
      valorEQuantidadePorVendedor: jest
        .fn()
        .mockResolvedValue(new Map([['v1', { valor: 1000, quantidade: 4 }]])),
    };
    const service = new ComparativoVendedoresService(
      prisma as never,
      vendedorVendasService as unknown as VendedorVendasService,
    );

    const [resultado] = await service.obter(['v1'], {});

    expect(resultado.valorVendido).toBe(1000);
    expect(resultado.ticketMedio).toBe(250);
  });

  it('taxa de aprovacao considera so solicitacoes decididas (nao PENDENTE)', async () => {
    const prisma = prismaFake({
      vendedores: [{ id: 'v1', nome: 'Ana' }],
      solicitacoesGroupBy: [
        { vendedorSolicitanteId: 'v1', status: 'APROVADO', _count: 3 },
        { vendedorSolicitanteId: 'v1', status: 'REJEITADO', _count: 1 },
      ],
    });
    const vendedorVendasService = {
      valorEQuantidadePorVendedor: jest.fn().mockResolvedValue(new Map()),
    };
    const service = new ComparativoVendedoresService(
      prisma as never,
      vendedorVendasService as unknown as VendedorVendasService,
    );

    const [resultado] = await service.obter(['v1'], {});

    expect(resultado.taxaAprovacaoDesconto).toBe(75);
  });

  it('sem nenhuma solicitacao decidida no periodo, taxa fica null (nao 0%)', async () => {
    const prisma = prismaFake({ vendedores: [{ id: 'v1', nome: 'Ana' }] });
    const vendedorVendasService = {
      valorEQuantidadePorVendedor: jest.fn().mockResolvedValue(new Map()),
    };
    const service = new ComparativoVendedoresService(
      prisma as never,
      vendedorVendasService as unknown as VendedorVendasService,
    );

    const [resultado] = await service.obter(['v1'], {});

    expect(resultado.taxaAprovacaoDesconto).toBeNull();
  });

  it('conta visitas canceladas de fora (canceladaEm: null no filtro)', async () => {
    const prisma = prismaFake({
      vendedores: [{ id: 'v1', nome: 'Ana' }],
      visitasGroupBy: [{ vendedorId: 'v1', _count: 5 }],
    });
    const vendedorVendasService = {
      valorEQuantidadePorVendedor: jest.fn().mockResolvedValue(new Map()),
    };
    const service = new ComparativoVendedoresService(
      prisma as never,
      vendedorVendasService as unknown as VendedorVendasService,
    );

    const [resultado] = await service.obter(['v1'], {});

    expect(resultado.quantidadeVisitas).toBe(5);
    expect(prisma.visita.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ canceladaEm: null }),
      }),
    );
  });

  it('retorna uma linha por vendedorId pedido, mesmo sem nenhum dado', async () => {
    const prisma = prismaFake({});
    const vendedorVendasService = {
      valorEQuantidadePorVendedor: jest.fn().mockResolvedValue(new Map()),
    };
    const service = new ComparativoVendedoresService(
      prisma as never,
      vendedorVendasService as unknown as VendedorVendasService,
    );

    const resultado = await service.obter(['v1', 'v2'], {});

    expect(resultado.map((r) => r.vendedorId)).toEqual(['v1', 'v2']);
    expect(resultado.every((r) => r.valorVendido === 0 && r.quantidadeVisitas === 0)).toBe(true);
  });
});
