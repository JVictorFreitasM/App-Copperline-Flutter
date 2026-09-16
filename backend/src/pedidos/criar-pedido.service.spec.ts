import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CriarPedidoService } from './criar-pedido.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';

const ESCOPO_TODOS: EscopoClientes = { tipo: 'TODOS' };

const PRODUTO_PADRAO = {
  id: 'produto-1',
  idExternoErp: 'produto-externo-1',
  pesoLiquidoKg: null,
  pesoBrutoKg: null,
};
const FORMA_PAGAMENTO_PADRAO = {
  id: 'forma-1',
  idExternoErp: 'forma-externo-1',
  inativa: false,
};
const CONDICAO_PAGAMENTO_PADRAO = {
  id: 'condicao-1',
  idExternoErp: 'condicao-externo-1',
  validade: null,
  parcelas: [{ percentual: 100, prazo: 30 }],
};
const TABELA_PRECO_PADRAO = { idExternoErp: 'tabela-externo-1' };

function prismaFake(overrides: {
  vendedor?: Record<string, unknown> | null;
  cliente?: Record<string, unknown> | null;
  produtos?: Record<string, unknown>[];
  formaPagamento?: Record<string, unknown> | null;
  condicaoPagamento?: Record<string, unknown> | null;
  tabelaPreco?: Record<string, unknown> | null;
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
          'vendedor' in overrides ? overrides.vendedor : { id: 'vendedor-1', idExternoErp: 'vendedor-externo-1' },
        ),
    },
    cliente: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          'cliente' in overrides ? overrides.cliente : { id: 'cliente-1', idExternoErp: 'cliente-externo-1' },
        ),
    },
    // Um produto "generico" por padrao (sem peso, com idExternoErp) - so
    // pra nao quebrar a resolucao de itens do ERP em testes que nao
    // exercitam peso especificamente. Testes de peso (bloco abaixo)
    // sobrescrevem via overrides.produtos.
    produto: {
      findMany: jest.fn().mockResolvedValue(overrides.produtos ?? [PRODUTO_PADRAO]),
    },
    formaPagamento: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          'formaPagamento' in overrides ? overrides.formaPagamento : FORMA_PAGAMENTO_PADRAO,
        ),
    },
    condicaoPagamento: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          'condicaoPagamento' in overrides ? overrides.condicaoPagamento : CONDICAO_PAGAMENTO_PADRAO,
        ),
    },
    tabelaPreco: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          'tabelaPreco' in overrides ? overrides.tabelaPreco : TABELA_PRECO_PADRAO,
        ),
    },
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
    _tx: tx,
  };
}

function produtoCalculoServiceFake(
  resultado: { quantidade: number; unidade: string; valorFinal: number } = {
    quantidade: 3,
    unidade: 'PECA',
    valorFinal: 90,
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

function configuracaoTabelaPrecoServiceFake(codigo: string | null = '110') {
  return { obterCodigoSelecionado: jest.fn().mockResolvedValue(codigo) };
}

// Helper - monta os 5 argumentos do construtor com fakes padrao, so
// sobrescrevendo o que o teste precisa (a maioria dos testes so mexe nos
// 2-3 primeiros).
function criarService(
  prisma: ReturnType<typeof prismaFake>,
  produtoCalculoService = produtoCalculoServiceFake(),
  solicitacoesDescontoService = solicitacoesDescontoServiceFake(),
  pedidoErpClientService = pedidoErpClientServiceFake(),
  configuracaoTabelaPrecoService = configuracaoTabelaPrecoServiceFake(),
) {
  return new CriarPedidoService(
    prisma as never,
    produtoCalculoService as never,
    solicitacoesDescontoService as never,
    pedidoErpClientService as never,
    configuracaoTabelaPrecoService as never,
  );
}

const INPUT_BASE = {
  clienteId: 'cliente-1',
  percentualDesconto: 10,
  formaPagamentoId: 'forma-1',
  condicaoPagamentoId: 'condicao-1',
  itens: [{ produtoId: 'produto-1', metrosDesejados: 90 }],
};

describe('CriarPedidoService.criar', () => {
  it('lanca ForbiddenException quando o usuario autenticado nao e um vendedor cadastrado', async () => {
    const prisma = prismaFake({ vendedor: null });
    const service = criarService(prisma);

    await expect(service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lanca NotFoundException quando o cliente nao existe ou esta fora do escopo', async () => {
    const prisma = prismaFake({ cliente: null });
    const service = criarService(prisma);

    await expect(service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lanca NotFoundException sem consultar o banco quando o escopo e NENHUM', async () => {
    const prisma = prismaFake();
    const service = criarService(prisma);

    await expect(
      service.criar(INPUT_BASE, 'u1', { tipo: 'NENHUM' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
  });

  it('lanca NotFoundException quando a forma de pagamento nao existe ou esta inativa', async () => {
    const prisma = prismaFake({ formaPagamento: { ...FORMA_PAGAMENTO_PADRAO, inativa: true } });
    const service = criarService(prisma);

    await expect(service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lanca NotFoundException quando a condicao de pagamento nao existe ou ja expirou', async () => {
    const prisma = prismaFake({
      condicaoPagamento: { ...CONDICAO_PAGAMENTO_PADRAO, validade: new Date('2020-01-01') },
    });
    const service = criarService(prisma);

    await expect(service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS)).rejects.toThrow(
      NotFoundException,
    );
  });

  // OS-novas-implementacoes.md Bloco 2 - "verificacao de necessidade de
  // checagem por role em POST /pedidos": cobertura explicita dos 3 papeis
  // (nao so' TODOS/NENHUM acima) confirmando que o escopo por si so' ja'
  // barra criacao de pedido fora da carteira, sem precisar de
  // requireRole(...) no controller (ver comentario em
  // pedidos.controller.ts).
  it('VENDEDOR comum (escopo PROPRIO) so cria pedido pra cliente da propria carteira', async () => {
    const prisma = prismaFake();
    const service = criarService(prisma);

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
    const service = criarService(prisma);

    await expect(
      service.criar(INPUT_BASE, 'u1', { tipo: 'PROPRIO', vendedorId: 'vend-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('SUPERVISOR/GERENTE (escopo EQUIPE) so cria pedido pra cliente atendido por alguem da equipe', async () => {
    const prisma = prismaFake();
    const service = criarService(prisma);

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
    const service = criarService(prisma);

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
      valorFinal: 90,
    });
    const solicitacoesDescontoService = solicitacoesDescontoServiceFake({
      necessitaAprovacao: false,
    });
    const pedidoErpClientService = pedidoErpClientServiceFake({
      resolve: { idExterno: 'erp-123', codigoIntegrador: 'pedido-1' },
    });
    const service = criarService(
      prisma,
      produtoCalculoService,
      solicitacoesDescontoService,
      pedidoErpClientService,
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
          formaPagamentoId: 'forma-1',
          condicaoPagamentoId: 'condicao-1',
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

  it('monta o payload do ERP com os IDs externos resolvidos e parcelas derivadas da condicao de pagamento', async () => {
    const prisma = prismaFake();
    const produtoCalculoService = produtoCalculoServiceFake({
      quantidade: 3,
      unidade: 'PECA',
      valorFinal: 90,
    });
    const pedidoErpClientService = pedidoErpClientServiceFake();
    const service = criarService(
      prisma,
      produtoCalculoService,
      solicitacoesDescontoServiceFake(),
      pedidoErpClientService,
    );

    await service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS);

    expect(pedidoErpClientService.criar).toHaveBeenCalledWith({
      clienteIdExterno: 'cliente-externo-1',
      vendedorIdExterno: 'vendedor-externo-1',
      idCondicaoPagamento: 'condicao-externo-1',
      percentualDesconto: 10,
      itens: [
        {
          produtoIdExterno: 'produto-externo-1',
          idTabelaPreco: 'tabela-externo-1',
          quantidade: 3,
          valorUnitario: 30,
        },
      ],
      parcelas: [
        expect.objectContaining({
          idFormaPagamento: 'forma-externo-1',
          valor: 81, // 90 * (1 - 10%) = 81, 1 parcela de 100%
        }),
      ],
    });
  });

  it('sem tabela de preco selecionada: falha antes de chamar o ERP', async () => {
    const prisma = prismaFake();
    const service = criarService(
      prisma,
      produtoCalculoServiceFake(),
      solicitacoesDescontoServiceFake(),
      pedidoErpClientServiceFake(),
      configuracaoTabelaPrecoServiceFake(null),
    );

    await expect(service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS)).rejects.toThrow(
      /Nenhuma tabela de preço selecionada/,
    );
    expect(prisma._tx.pedido.create).not.toHaveBeenCalled();
  });

  it('acima do limite: NAO chama o ERP e persiste o pedido com status AGUARDANDO_APROVACAO (criterio de aceite)', async () => {
    const prisma = prismaFake();
    const produtoCalculoService = produtoCalculoServiceFake();
    const solicitacoesDescontoService = solicitacoesDescontoServiceFake({
      necessitaAprovacao: true,
      solicitacao: { id: 'solicitacao-1' },
    });
    const pedidoErpClientService = pedidoErpClientServiceFake();
    const service = criarService(
      prisma,
      produtoCalculoService,
      solicitacoesDescontoService,
      pedidoErpClientService,
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
        data: expect.objectContaining({
          statusLocal: 'AGUARDANDO_APROVACAO',
          formaPagamentoId: 'forma-1',
          condicaoPagamentoId: 'condicao-1',
        }),
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
    const service = criarService(
      prisma,
      produtoCalculoService,
      solicitacoesDescontoService,
      pedidoErpClientService,
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
    const service = criarService(
      prisma,
      produtoCalculoService as never,
      solicitacoesDescontoService,
      pedidoErpClientService,
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
      produtos: [{ id: 'produto-1', idExternoErp: 'produto-externo-1', pesoLiquidoKg: 10, pesoBrutoKg: 12 }],
    });
    const service = criarService(prisma);

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
      produtos: [{ id: 'produto-1', idExternoErp: 'produto-externo-1', pesoLiquidoKg: null, pesoBrutoKg: null }],
    });
    const service = criarService(prisma);

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
      produtos: [{ id: 'produto-1', idExternoErp: 'produto-externo-1', pesoLiquidoKg: 10, pesoBrutoKg: null }],
    });
    const service = criarService(prisma);

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
