import { ForbiddenException } from '@nestjs/common';
import { MobileSnapshotService } from './mobile-snapshot.service';
import type { IdpUser } from '@copperline/idp-client';

const IDP_USER: IdpUser = { sub: 's1', email: 'a@a.com', name: 'A', role: null, system: 'x' };

function prismaFake(overrides: {
  vendedor?: Record<string, unknown> | null;
  clientes?: Record<string, unknown>[];
  produtos?: Record<string, unknown>[];
  pedidos?: Record<string, unknown>[];
  saldosEstoque?: Record<string, unknown>[];
} = {}) {
  return {
    vendedor: {
      findFirst: jest
        .fn()
        .mockResolvedValue('vendedor' in overrides ? overrides.vendedor : { id: 'vendedor-1' }),
    },
    cliente: {
      findMany: jest.fn().mockResolvedValue(overrides.clientes ?? []),
    },
    produto: {
      findMany: jest.fn().mockResolvedValue(overrides.produtos ?? []),
    },
    pedido: {
      findMany: jest.fn().mockResolvedValue(overrides.pedidos ?? []),
    },
    saldoEstoque: {
      findMany: jest.fn().mockResolvedValue(overrides.saldosEstoque ?? []),
    },
  };
}

function vendedorEscopoServiceFake(escopo: { tipo: string; [k: string]: unknown } = { tipo: 'TODOS' }) {
  return { resolverEscopoClientes: jest.fn().mockResolvedValue(escopo) };
}

describe('MobileSnapshotService.obter', () => {
  it('lanca ForbiddenException quando o usuario nao e um vendedor cadastrado', async () => {
    const prisma = prismaFake({ vendedor: null });
    const service = new MobileSnapshotService(
      prisma as never,
      vendedorEscopoServiceFake() as never,
    );

    await expect(service.obter(IDP_USER, 'u1')).rejects.toThrow(ForbiddenException);
  });

  it('retorna lista vazia de clientes sem consultar o banco quando o escopo e NENHUM', async () => {
    const prisma = prismaFake();
    const service = new MobileSnapshotService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'NENHUM' }) as never,
    );

    const resultado = await service.obter(IDP_USER, 'u1');

    expect(resultado.clientes).toEqual([]);
    expect(prisma.cliente.findMany).not.toHaveBeenCalled();
  });

  it('busca pedidos filtrados pelo PROPRIO vendedor (nao a carteira toda de clientes)', async () => {
    const prisma = prismaFake();
    const service = new MobileSnapshotService(
      prisma as never,
      vendedorEscopoServiceFake() as never,
    );

    await service.obter(IDP_USER, 'u1');

    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vendedorId: 'vendedor-1' } }),
    );
  });

  it('produtos NAO sao filtrados por escopo - so por inativo:false', async () => {
    const prisma = prismaFake();
    const service = new MobileSnapshotService(
      prisma as never,
      vendedorEscopoServiceFake() as never,
    );

    await service.obter(IDP_USER, 'u1');

    expect(prisma.produto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { inativo: false } }),
    );
  });

  it('monta o snapshot com geradoEm e as tres listas mapeadas', async () => {
    const prisma = prismaFake({
      clientes: [
        {
          id: 'c1',
          idExternoErp: 'ext-1',
          cpfCnpj: null,
          razaoSocial: 'Cliente A',
          nomeFantasia: null,
          inativo: false,
          incompleto: false,
          sincronizadoEm: new Date(),
        },
      ],
    });
    const service = new MobileSnapshotService(
      prisma as never,
      vendedorEscopoServiceFake() as never,
    );

    const resultado = await service.obter(IDP_USER, 'u1');

    expect(resultado.geradoEm).toEqual(expect.any(String));
    expect(resultado.clientes).toHaveLength(1);
    expect(resultado.clientes[0].id).toBe('c1');
  });

  it('inclui estoque no snapshot, juntando saldo com produto pelo codigo', async () => {
    const prisma = prismaFake({
      produtos: [{ id: 'p1', codigo: 'COD-1', nome: 'Produto 1', inativo: false }],
      saldosEstoque: [
        {
          codigoProduto: 'COD-1',
          quantidadeDisponivel: { toString: () => '42' },
          atualizadoEm: new Date('2026-09-01T00:00:00.000Z'),
        },
      ],
    });
    const service = new MobileSnapshotService(
      prisma as never,
      vendedorEscopoServiceFake() as never,
    );

    const resultado = await service.obter(IDP_USER, 'u1');

    expect(resultado.estoque).toEqual([
      {
        produtoId: 'p1',
        codigo: 'COD-1',
        itens: [
          {
            localCodigo: null,
            localNome: null,
            lote: null,
            fabricadoEm: null,
            quantidade: '42',
          },
        ],
        atualizadoEm: '2026-09-01T00:00:00.000Z',
      },
    ]);
  });

  it('ignora saldo de estoque cujo codigo nao bate com nenhum produto retornado', async () => {
    const prisma = prismaFake({
      produtos: [{ id: 'p1', codigo: 'COD-1', nome: 'Produto 1', inativo: false }],
      saldosEstoque: [
        {
          codigoProduto: 'COD-ORFAO',
          quantidadeDisponivel: { toString: () => '10' },
          atualizadoEm: new Date(),
        },
      ],
    });
    const service = new MobileSnapshotService(
      prisma as never,
      vendedorEscopoServiceFake() as never,
    );

    const resultado = await service.obter(IDP_USER, 'u1');

    expect(resultado.estoque).toEqual([]);
  });
});
