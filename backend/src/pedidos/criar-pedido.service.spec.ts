import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CriarPedidoService } from './criar-pedido.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';

const ESCOPO_TODOS: EscopoClientes = { tipo: 'TODOS' };

function prismaFake(overrides: {
  vendedor?: Record<string, unknown> | null;
  cliente?: Record<string, unknown> | null;
  produtos?: Record<string, unknown>[];
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
    // Sem peso cadastrado por padrao (pesoLiquidoTotalKg/pesoBrutoTotalKg
    // ficam null) - testes especificos de peso sobrescrevem via
    // overrides.produtos.
    produto: {
      findMany: jest.fn().mockResolvedValue(overrides.produtos ?? []),
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

  // OS-novas-implementacoes.md Bloco 2 - "verificacao de necessidade de
  // checagem por role em POST /pedidos": cobertura explicita dos 3 papeis
  // (nao so' TODOS/NENHUM acima) confirmando que o escopo por si so' ja'
  // barra criacao de pedido fora da carteira, sem precisar de
  // requireRole(...) no controller (ver comentario em
  // pedidos.controller.ts).
  it('VENDEDOR comum (escopo PROPRIO) so cria pedido pra cliente da propria carteira', async () => {
    const prisma = prismaFake();
    const service = new CriarPedidoService(
      prisma as never,
      produtoCalculoServiceFake() as never,
      solicitacoesDescontoServiceFake() as never,
      pedidoErpClientServiceFake() as never,
    );

    await service.criar(INPUT_BASE, 'u1', { tipo: 'PROPRIO', vendedorId: 'vend-1' });

    expect(prisma.cliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'cliente-1',
          vendedores: { some: { vendedorId: 'vend-1' } },
        }),
      }),
    );
  });

  it('VENDEDOR comum (escopo PROPRIO) recebe 404 pra cliente fora da propria carteira', async () => {
    const prisma = prismaFake({ cliente: null });
    const service = new CriarPedidoService(
      prisma as never,
      produtoCalculoServiceFake() as never,
      solicitacoesDescontoServiceFake() as never,
      pedidoErpClientServiceFake() as never,
    );

    await expect(
      service.criar(INPUT_BASE, 'u1', { tipo: 'PROPRIO', vendedorId: 'vend-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('SUPERVISOR/GERENTE (escopo EQUIPE) so cria pedido pra cliente atendido por alguem da equipe', async () => {
    const prisma = prismaFake();
    const service = new CriarPedidoService(
      prisma as never,
      produtoCalculoServiceFake() as never,
      solicitacoesDescontoServiceFake() as never,
      pedidoErpClientServiceFake() as never,
    );

    await service.criar(INPUT_BASE, 'u-sup', {
      tipo: 'EQUIPE',
      vendedorIds: ['vend-1', 'vend-2'],
    });

    expect(prisma.cliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'cliente-1',
          vendedores: { some: { vendedorId: { in: ['vend-1', 'vend-2'] } } },
        }),
      }),
    );
  });

  it('ADMIN (escopo TODOS) cria pedido pra qualquer cliente', async () => {
    const prisma = prismaFake();
    const service = new CriarPedidoService(
      prisma as never,
      produtoCalculoServiceFake() as never,
      solicitacoesDescontoServiceFake() as never,
      pedidoErpClientServiceFake() as never,
    );

    await service.criar(INPUT_BASE, 'u-admin', ESCOPO_TODOS);

    expect(prisma.cliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'cliente-1' }) }),
    );
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

// OS-novas-implementacoes.md Bloco 3 - peso total do pedido, calculado a
// partir de Produto.pesoLiquidoKg/pesoBrutoKg * QUANTIDADE (nao os metros
// pedidos - decisao confirmada: peso e' da peca/unidade, nao taxa por
// metro). produtoCalculoServiceFake() por padrao devolve quantidade: 3
// pra INPUT_BASE (1 item, produto-1).
describe('CriarPedidoService.criar - peso total (Bloco 3)', () => {
  it('calcula pesoLiquidoTotalKg/pesoBrutoTotalKg = peso do produto x quantidade', async () => {
    const prisma = prismaFake({
      produtos: [{ id: 'produto-1', pesoLiquidoKg: 10, pesoBrutoKg: 12 }],
    });
    const service = new CriarPedidoService(
      prisma as never,
      produtoCalculoServiceFake() as never,
      solicitacoesDescontoServiceFake() as never,
      pedidoErpClientServiceFake() as never,
    );

    await service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS);

    expect(prisma._tx.pedido.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pesoLiquidoTotalKg: 30,
          pesoBrutoTotalKg: 36,
        }),
      }),
    );
  });

  it('pesoLiquidoTotalKg/pesoBrutoTotalKg ficam null quando o produto nao tem peso cadastrado', async () => {
    const prisma = prismaFake({
      produtos: [{ id: 'produto-1', pesoLiquidoKg: null, pesoBrutoKg: null }],
    });
    const service = new CriarPedidoService(
      prisma as never,
      produtoCalculoServiceFake() as never,
      solicitacoesDescontoServiceFake() as never,
      pedidoErpClientServiceFake() as never,
    );

    await service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS);

    expect(prisma._tx.pedido.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pesoLiquidoTotalKg: null,
          pesoBrutoTotalKg: null,
        }),
      }),
    );
  });

  it('liquido e bruto sao independentes - um faltando nao zera o outro', async () => {
    const prisma = prismaFake({
      produtos: [{ id: 'produto-1', pesoLiquidoKg: 10, pesoBrutoKg: null }],
    });
    const service = new CriarPedidoService(
      prisma as never,
      produtoCalculoServiceFake() as never,
      solicitacoesDescontoServiceFake() as never,
      pedidoErpClientServiceFake() as never,
    );

    await service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS);

    expect(prisma._tx.pedido.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pesoLiquidoTotalKg: 30,
          pesoBrutoTotalKg: null,
        }),
      }),
    );
  });
});
