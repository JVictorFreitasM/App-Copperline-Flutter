import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CriarPedidoService } from './criar-pedido.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';

const ESCOPO_TODOS: EscopoClientes = { tipo: 'TODOS' };

function prismaFake(overrides: {
  vendedor?: Record<string, unknown> | null;
  cliente?: Record<string, unknown> | null;
} = {}) {
  const pedidoCreate = jest
    .fn()
    .mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'pedido-1',
      idExternoErp: data.idExternoErp ?? null,
      ...data,
    }));
  const pedidoItemCreateMany = jest.fn().mockResolvedValue(undefined);
  const solicitacaoDescontoUpdate = jest.fn().mockResolvedValue(undefined);
  const pedidoHistoricoStatusCreate = jest.fn().mockResolvedValue(undefined);

  const tx = {
    pedido: { create: pedidoCreate },
    pedidoItem: { createMany: pedidoItemCreateMany },
    solicitacaoDesconto: { update: solicitacaoDescontoUpdate },
    pedidoHistoricoStatus: { create: pedidoHistoricoStatusCreate },
  };

  return {
    vendedor: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          'vendedor' in overrides ? overrides.vendedor : { id: 'vendedor-1' },
        ),
    },
    cliente: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          'cliente' in overrides ? overrides.cliente : { id: 'cliente-1' },
        ),
    },
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
    _tx: tx,
  };
}

function produtoCalculoServiceFake(
  resultado: { quantidade: number; unidade: string; valorTotal: number } = {
    quantidade: 3,
    unidade: 'PECA',
    valorTotal: 90,
  },
) {
  return { calcular: jest.fn().mockResolvedValue(resultado) };
}

function solicitacoesDescontoServiceFake(
  avaliacao:
    | { necessitaAprovacao: false }
    | { necessitaAprovacao: true; solicitacao: { id: string } } = {
    necessitaAprovacao: false,
  },
) {
  return { avaliarDesconto: jest.fn().mockResolvedValue(avaliacao) };
}

function pedidoErpClientServiceFake(
  overrides: {
    resolve?: { idExterno: string; codigoIntegrador: string };
    reject?: Error;
  } = {},
) {
  const criar = overrides.reject
    ? jest.fn().mockRejectedValue(overrides.reject)
    : jest
        .fn()
        .mockResolvedValue(
          overrides.resolve ?? { idExterno: 'erp-1', codigoIntegrador: 'pedido-1' },
        );
  return { criar };
}

const INPUT_BASE = {
  clienteId: 'cliente-1',
  percentualDesconto: 10,
  itens: [{ produtoId: 'produto-1', metrosDesejados: 90 }],
};

describe('CriarPedidoService.criar', () => {
  it('lanca ForbiddenException quando o usuario autenticado nao e um vendedor cadastrado', async () => {
    const prisma = prismaFake({ vendedor: null });
    const service = new CriarPedidoService(
      prisma as never,
      produtoCalculoServiceFake() as never,
      solicitacoesDescontoServiceFake() as never,
      pedidoErpClientServiceFake() as never,
    );

    await expect(service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lanca NotFoundException quando o cliente nao existe ou esta fora do escopo', async () => {
    const prisma = prismaFake({ cliente: null });
    const service = new CriarPedidoService(
      prisma as never,
      produtoCalculoServiceFake() as never,
      solicitacoesDescontoServiceFake() as never,
      pedidoErpClientServiceFake() as never,
    );

    await expect(service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lanca NotFoundException sem consultar o banco quando o escopo e NENHUM', async () => {
    const prisma = prismaFake();
    const service = new CriarPedidoService(
      prisma as never,
      produtoCalculoServiceFake() as never,
      solicitacoesDescontoServiceFake() as never,
      pedidoErpClientServiceFake() as never,
    );

    await expect(
      service.criar(INPUT_BASE, 'u1', { tipo: 'NENHUM' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
  });

  it('dentro do limite: envia ao ERP e persiste o pedido com status ENVIADO (criterio de aceite)', async () => {
    const prisma = prismaFake();
    const produtoCalculoService = produtoCalculoServiceFake({
      quantidade: 3,
      unidade: 'PECA',
      valorTotal: 90,
    });
    const solicitacoesDescontoService = solicitacoesDescontoServiceFake({
      necessitaAprovacao: false,
    });
    const pedidoErpClientService = pedidoErpClientServiceFake({
      resolve: { idExterno: 'erp-123', codigoIntegrador: 'pedido-1' },
    });
    const service = new CriarPedidoService(
      prisma as never,
      produtoCalculoService as never,
      solicitacoesDescontoService as never,
      pedidoErpClientService as never,
    );

    const resultado = await service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS);

    expect(pedidoErpClientService.criar).toHaveBeenCalled();
    expect(resultado.status).toBe('ENVIADO');
    expect(resultado.idExternoErp).toBe('erp-123');
    expect(prisma._tx.pedido.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idExternoErp: 'erp-123',
          statusLocal: 'ENVIADO',
        }),
      }),
    );
    expect(prisma._tx.pedidoHistoricoStatus.create).toHaveBeenCalledWith({
      data: {
        pedidoId: 'pedido-1',
        statusAnterior: null,
        statusNovo: 'ENVIADO',
        alteradoPor: 'u1',
      },
    });
  });

  it('acima do limite: NAO chama o ERP e persiste o pedido com status AGUARDANDO_APROVACAO (criterio de aceite)', async () => {
    const prisma = prismaFake();
    const produtoCalculoService = produtoCalculoServiceFake();
    const solicitacoesDescontoService = solicitacoesDescontoServiceFake({
      necessitaAprovacao: true,
      solicitacao: { id: 'solicitacao-1' },
    });
    const pedidoErpClientService = pedidoErpClientServiceFake();
    const service = new CriarPedidoService(
      prisma as never,
      produtoCalculoService as never,
      solicitacoesDescontoService as never,
      pedidoErpClientService as never,
    );

    const resultado = await service.criar(
      { ...INPUT_BASE, percentualDesconto: 30 },
      'u1',
      ESCOPO_TODOS,
    );

    expect(pedidoErpClientService.criar).not.toHaveBeenCalled();
    expect(resultado.status).toBe('AGUARDANDO_APROVACAO');
    expect(resultado.idExternoErp).toBeNull();
    expect(resultado.solicitacaoDescontoId).toBe('solicitacao-1');
    expect(prisma._tx.pedido.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statusLocal: 'AGUARDANDO_APROVACAO' }),
      }),
    );
    expect(prisma._tx.solicitacaoDesconto.update).toHaveBeenCalledWith({
      where: { id: 'solicitacao-1' },
      data: { pedidoId: 'pedido-1' },
    });
    expect(prisma._tx.pedidoHistoricoStatus.create).toHaveBeenCalledWith({
      data: {
        pedidoId: 'pedido-1',
        statusAnterior: null,
        statusNovo: 'AGUARDANDO_APROVACAO',
        alteradoPor: 'u1',
      },
    });
  });

  it('erro do ERP: nao persiste NENHUM registro local (criterio de aceite - sem orfao)', async () => {
    const prisma = prismaFake();
    const produtoCalculoService = produtoCalculoServiceFake();
    const solicitacoesDescontoService = solicitacoesDescontoServiceFake({
      necessitaAprovacao: false,
    });
    const pedidoErpClientService = pedidoErpClientServiceFake({
      reject: new Error('Radar: produto sem saldo suficiente'),
    });
    const service = new CriarPedidoService(
      prisma as never,
      produtoCalculoService as never,
      solicitacoesDescontoService as never,
      pedidoErpClientService as never,
    );

    await expect(service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS)).rejects.toThrow(
      'Radar: produto sem saldo suficiente',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma._tx.pedido.create).not.toHaveBeenCalled();
  });

  it('erro no calculo de um item propaga sem persistir nada (mesmo raciocinio de nao deixar orfao)', async () => {
    const prisma = prismaFake();
    const produtoCalculoService = {
      calcular: jest.fn().mockRejectedValue(new Error('Produto sem tipoVenda configurado')),
    };
    const solicitacoesDescontoService = solicitacoesDescontoServiceFake();
    const pedidoErpClientService = pedidoErpClientServiceFake();
    const service = new CriarPedidoService(
      prisma as never,
      produtoCalculoService as never,
      solicitacoesDescontoService as never,
      pedidoErpClientService as never,
    );

    await expect(service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS)).rejects.toThrow(
      'Produto sem tipoVenda configurado',
    );
    expect(solicitacoesDescontoService.avaliarDesconto).not.toHaveBeenCalled();
    expect(prisma._tx.pedido.create).not.toHaveBeenCalled();
  });
});
