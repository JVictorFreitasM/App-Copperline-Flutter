import { NotFoundException } from '@nestjs/common';
import { PedidosService } from './pedidos.service';

function prismaFake(overrides: {
  findMany?: unknown[];
  count?: number;
  findUnique?: unknown;
  historico?: unknown[];
}) {
  return {
    pedido: {
      findMany: jest.fn().mockResolvedValue(overrides.findMany ?? []),
      count: jest.fn().mockResolvedValue(overrides.count ?? 0),
      findUnique: jest.fn().mockResolvedValue(overrides.findUnique ?? null),
    },
    pedidoHistoricoStatus: {
      findMany: jest.fn().mockResolvedValue(overrides.historico ?? []),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

describe('PedidosService.listar', () => {
  it('inclui um resumo do cliente (id + razaoSocial), sem a arvore fiscal', async () => {
    const pedidoBruto = {
      id: '1',
      idExternoErp: 'ext-1',
      numero: 'PED-1',
      situacao: 'FATURADO',
      dataHoraUltimaAlteracao: new Date('2026-01-01'),
      valorTotal: { toString: () => '150.00' },
      incompleto: false,
      sincronizadoEm: new Date('2026-01-01'),
      cliente: { id: 'cli-1', razaoSocial: 'Cliente A' },
    };
    const prisma = prismaFake({ findMany: [pedidoBruto], count: 1 });
    const service = new PedidosService(prisma as never);

    const resultado = await service.listar({ page: 1, limit: 20 });

    expect(resultado.data[0].cliente).toEqual({
      id: 'cli-1',
      razaoSocial: 'Cliente A',
    });
    expect(
      (resultado.data[0] as Record<string, unknown>).itens,
    ).toBeUndefined();
  });

  it('filtra por clienteId e situacao quando informados', async () => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new PedidosService(prisma as never);

    await service.listar({
      page: 1,
      limit: 20,
      clienteId: 'cli-1',
      situacao: 'FATURADO',
    });

    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clienteId: 'cli-1', situacao: 'FATURADO' },
      }),
    );
  });

  it('filtra por clienteNome (razaoSocial/nomeFantasia) quando informado', async () => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new PedidosService(prisma as never);

    await service.listar({ page: 1, limit: 20, clienteNome: 'Acme' });

    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          cliente: {
            OR: [
              { razaoSocial: { contains: 'Acme', mode: 'insensitive' } },
              { nomeFantasia: { contains: 'Acme', mode: 'insensitive' } },
            ],
          },
        },
      }),
    );
  });

  it('filtra por periodo (dataInicial/dataFinal) sobre dataHoraUltimaAlteracao', async () => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new PedidosService(prisma as never);

    await service.listar({
      page: 1,
      limit: 20,
      dataInicial: '2026-01-01',
      dataFinal: '2026-01-31',
    });

    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dataHoraUltimaAlteracao: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-01-31T23:59:59.999Z'),
          },
        },
      }),
    );
  });
});

describe('PedidosService.buscarPorId', () => {
  it('lança NotFoundException quando o pedido nao existe', async () => {
    const prisma = prismaFake({ findUnique: null });
    const service = new PedidosService(prisma as never);

    await expect(service.buscarPorId('inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('mapeia itens com resumo de produto no detalhe', async () => {
    const prisma = prismaFake({
      findUnique: {
        id: '1',
        idExternoErp: 'ext-1',
        numero: 'PED-1',
        situacao: 'PENDENTE',
        dataHoraUltimaAlteracao: null,
        valorTotal: null,
        incompleto: false,
        sincronizadoEm: new Date('2026-01-01'),
        cliente: null,
        itens: [
          {
            id: 'item-1',
            numero: 1,
            idItemGrade1: null,
            idItemGrade2: null,
            idItemGrade3: null,
            quantidadeVenda: { toString: () => '2' },
            valorUnitario: { toString: () => '10' },
            valorTotal: { toString: () => '20' },
            situacao: 'PENDENTE',
            produto: { id: 'prod-1', nome: 'Produto A', codigo: 'P1' },
          },
        ],
      },
    });
    const service = new PedidosService(prisma as never);

    const resultado = await service.buscarPorId('1');

    expect(resultado.itens).toEqual([
      {
        id: 'item-1',
        numero: 1,
        idItemGrade1: null,
        idItemGrade2: null,
        idItemGrade3: null,
        quantidadeVenda: '2',
        valorUnitario: '10',
        valorTotal: '20',
        situacao: 'PENDENTE',
        produto: { id: 'prod-1', nome: 'Produto A', codigo: 'P1' },
      },
    ]);
  });
});

describe('PedidosService.obterHistorico', () => {
  it('lanca NotFoundException quando o pedido nao existe', async () => {
    const prisma = prismaFake({ findUnique: null });
    const service = new PedidosService(prisma as never);

    await expect(service.obterHistorico('inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('retorna o historico em ordem cronologica, resolvendo o nome de quem alterou', async () => {
    const prisma = prismaFake({
      findUnique: { id: 'pedido-1' },
      historico: [
        {
          id: 'h1',
          statusAnterior: null,
          statusNovo: 'AGUARDANDO_APROVACAO',
          alteradoEm: new Date('2026-01-01T10:00:00.000Z'),
          usuario: { id: 'u1', nome: 'Fulano' },
        },
        {
          id: 'h2',
          statusAnterior: 'AGUARDANDO_APROVACAO',
          statusNovo: 'APROVADO',
          alteradoEm: new Date('2026-01-02T10:00:00.000Z'),
          usuario: { id: 'u-sup', nome: 'Supervisora' },
        },
      ],
    });
    const service = new PedidosService(prisma as never);

    const resultado = await service.obterHistorico('pedido-1');

    expect(resultado).toEqual([
      {
        id: 'h1',
        statusAnterior: null,
        statusNovo: 'AGUARDANDO_APROVACAO',
        alteradoPor: { id: 'u1', nome: 'Fulano' },
        alteradoEm: '2026-01-01T10:00:00.000Z',
      },
      {
        id: 'h2',
        statusAnterior: 'AGUARDANDO_APROVACAO',
        statusNovo: 'APROVADO',
        alteradoPor: { id: 'u-sup', nome: 'Supervisora' },
        alteradoEm: '2026-01-02T10:00:00.000Z',
      },
    ]);
    expect(prisma.pedidoHistoricoStatus.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pedidoId: 'pedido-1' },
        orderBy: { alteradoEm: 'asc' },
      }),
    );
  });
});
