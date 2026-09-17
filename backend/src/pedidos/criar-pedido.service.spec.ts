import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AxiosError, AxiosHeaders } from 'axios';
import { CriarPedidoService } from './criar-pedido.service';
import type { CriarPedidoInput } from './criar-pedido.service';
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
const CONTATO_PADRAO = { id: 'contato-1', clienteId: 'cliente-1' };

function prismaFake(overrides: {
  vendedor?: Record<string, unknown> | null;
  vendedorPorId?: Record<string, unknown> | null;
  cliente?: Record<string, unknown> | null;
  produtos?: Record<string, unknown>[];
  formaPagamento?: Record<string, unknown> | null;
  condicaoPagamento?: Record<string, unknown> | null;
  tabelaPreco?: Record<string, unknown> | null;
  contato?: Record<string, unknown> | null;
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
      findUnique: jest
        .fn()
        .mockResolvedValue(
          'vendedorPorId' in overrides
            ? overrides.vendedorPorId
            : { id: 'vendedor-2', idExternoErp: 'vendedor-externo-2', inativo: false },
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
    contatoCliente: {
      findFirst: jest
        .fn()
        .mockResolvedValue('contato' in overrides ? overrides.contato : CONTATO_PADRAO),
    },
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
    _tx: tx,
  };
}

function produtoCalculoServiceFake(
  resultado: {
    quantidade: number;
    unidade: string;
    valorUnitario: number;
    valorFinal: number;
  } = {
    quantidade: 3,
    unidade: 'PECA',
    valorUnitario: 30,
    valorFinal: 81, // 90 (30*3) com 10% de desconto
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

const INPUT_BASE: CriarPedidoInput = {
  clienteId: 'cliente-1',
  formaPagamentoId: 'forma-1',
  condicaoPagamentoId: 'condicao-1',
  itens: [{ produtoId: 'produto-1', metrosDesejados: 90, percentualDesconto: 10 }],
};

describe('CriarPedidoService.criar', () => {
  it('lanca ForbiddenException quando o usuario autenticado nao e um vendedor cadastrado (sem vendedorId)', async () => {
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

  it('lanca NotFoundException quando o contatoId nao pertence ao cliente do pedido', async () => {
    const prisma = prismaFake({ contato: null });
    const service = criarService(prisma);

    await expect(
      service.criar({ ...INPUT_BASE, contatoId: 'contato-de-outro-cliente' }, 'u1', ESCOPO_TODOS),
    ).rejects.toThrow(NotFoundException);
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

  describe('vendedorId (criar pedido em nome de outro vendedor da equipe)', () => {
    it('SUPERVISOR/GERENTE pode criar em nome de um vendedor dentro da propria equipe', async () => {
      const prisma = prismaFake({
        vendedorPorId: { id: 'vend-2', idExternoErp: 'vend-2-externo', inativo: false },
      });
      const service = criarService(prisma);

      const resultado = await service.criar(
        { ...INPUT_BASE, vendedorId: 'vend-2' },
        'u-sup',
        { tipo: 'EQUIPE', vendedorIds: ['vend-1', 'vend-2'] },
      );

      expect(resultado.status).toBe('ENVIADO');
      expect(prisma.vendedor.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'vend-2' } }),
      );
      expect(prisma._tx.pedido.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ vendedorId: 'vend-2' }) }),
      );
    });

    it('lanca ForbiddenException quando o vendedorId esta fora da equipe de quem chama', async () => {
      const prisma = prismaFake();
      const service = criarService(prisma);

      await expect(
        service.criar({ ...INPUT_BASE, vendedorId: 'vend-fora-da-equipe' }, 'u-sup', {
          tipo: 'EQUIPE',
          vendedorIds: ['vend-1', 'vend-2'],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanca ForbiddenException quando quem chama nao tem equipe (escopo PROPRIO) e tenta usar vendedorId', async () => {
      const prisma = prismaFake();
      const service = criarService(prisma);

      await expect(
        service.criar({ ...INPUT_BASE, vendedorId: 'vend-2' }, 'u1', {
          tipo: 'PROPRIO',
          vendedorId: 'vend-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN (escopo TODOS) pode criar em nome de qualquer vendedor', async () => {
      const prisma = prismaFake({
        vendedorPorId: { id: 'vend-9', idExternoErp: 'vend-9-externo', inativo: false },
      });
      const service = criarService(prisma);

      const resultado = await service.criar(
        { ...INPUT_BASE, vendedorId: 'vend-9' },
        'u-admin',
        ESCOPO_TODOS,
      );

      expect(resultado.status).toBe('ENVIADO');
    });

    it('lanca NotFoundException quando o vendedorId autorizado nao existe/esta inativo', async () => {
      const prisma = prismaFake({ vendedorPorId: null });
      const service = criarService(prisma);

      await expect(
        service.criar({ ...INPUT_BASE, vendedorId: 'vend-2' }, 'u-sup', {
          tipo: 'EQUIPE',
          vendedorIds: ['vend-1', 'vend-2'],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  it('dentro do limite: envia ao ERP e persiste o pedido com status ENVIADO (criterio de aceite)', async () => {
    const prisma = prismaFake();
    const produtoCalculoService = produtoCalculoServiceFake();
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

  it('persiste codigoTabelaPreco e contatoId escolhidos na criacao', async () => {
    const prisma = prismaFake();
    const service = criarService(prisma);

    await service.criar(
      { ...INPUT_BASE, codigoTabelaPreco: '110', contatoId: 'contato-1' },
      'u1',
      ESCOPO_TODOS,
    );

    expect(prisma._tx.pedido.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          codigoTabelaPreco: '110',
          contatoId: 'contato-1',
        }),
      }),
    );
  });

  it('persiste percentualDesconto/valorUnitarioBruto/observacoes por item', async () => {
    const prisma = prismaFake();
    const service = criarService(prisma);

    await service.criar(
      {
        ...INPUT_BASE,
        itens: [
          {
            produtoId: 'produto-1',
            metrosDesejados: 90,
            percentualDesconto: 10,
            observacoes: 'entregar no deposito',
          },
        ],
      },
      'u1',
      ESCOPO_TODOS,
    );

    expect(prisma._tx.pedidoItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          produtoId: 'produto-1',
          quantidadeVenda: 3,
          valorUnitario: 27, // 81 (valorTotal com desconto) / 3
          valorUnitarioBruto: 30,
          valorTotal: 81,
          percentualDesconto: 10,
          observacoes: 'entregar no deposito',
        }),
      ],
    });
  });

  it('monta o payload do ERP com os IDs externos resolvidos, valorUnitario BRUTO por item e percentual blendado', async () => {
    const prisma = prismaFake();
    const produtoCalculoService = produtoCalculoServiceFake();
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
      percentualDesconto: 10, // blendado: (1 - 81/90) * 100 = 10
      itens: [
        {
          produtoIdExterno: 'produto-externo-1',
          idTabelaPreco: 'tabela-externo-1',
          quantidade: 3,
          valorUnitario: 30, // BRUTO (sem desconto), nao valorTotal/quantidade
        },
      ],
      parcelas: [
        expect.objectContaining({
          idFormaPagamento: 'forma-externo-1',
          valor: 81, // valorComDesconto * 100%
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
      { ...INPUT_BASE, itens: [{ ...INPUT_BASE.itens[0], percentualDesconto: 30 }] },
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

  it('gate de aprovacao usa o MAIOR desconto entre os itens (nao o primeiro nem uma media)', async () => {
    const prisma = prismaFake({
      produtos: [
        { id: 'produto-1', idExternoErp: 'produto-externo-1', pesoLiquidoKg: null, pesoBrutoKg: null },
        { id: 'produto-2', idExternoErp: 'produto-externo-2', pesoLiquidoKg: null, pesoBrutoKg: null },
      ],
    });
    const produtoCalculoService = {
      calcular: jest.fn().mockResolvedValue({
        quantidade: 1,
        unidade: 'PECA',
        valorUnitario: 100,
        valorFinal: 100,
      }),
    };
    const solicitacoesDescontoService = solicitacoesDescontoServiceFake();
    const service = criarService(
      prisma,
      produtoCalculoService as never,
      solicitacoesDescontoService,
    );

    await service.criar(
      {
        ...INPUT_BASE,
        itens: [
          { produtoId: 'produto-1', metrosDesejados: 10, percentualDesconto: 5 },
          { produtoId: 'produto-2', metrosDesejados: 10, percentualDesconto: 40 },
        ],
      },
      'u1',
      ESCOPO_TODOS,
    );

    expect(solicitacoesDescontoService.avaliarDesconto).toHaveBeenCalledWith(
      expect.objectContaining({ percentualSolicitado: 40 }),
    );
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

  it('erro do ERP (AxiosError): usa a mensagem do corpo da resposta, nao o texto generico do Axios', async () => {
    const prisma = prismaFake();
    const produtoCalculoService = produtoCalculoServiceFake();
    const solicitacoesDescontoService = solicitacoesDescontoServiceFake({
      necessitaAprovacao: false,
    });
    const erroAxios = new AxiosError(
      'Request failed with status code 400',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 400,
        statusText: 'Bad Request',
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
        data: { message: 'Vendedor MOCK-0001 não encontrado' },
      },
    );
    const pedidoErpClientService = pedidoErpClientServiceFake({ reject: erroAxios });
    const service = criarService(
      prisma,
      produtoCalculoService,
      solicitacoesDescontoService,
      pedidoErpClientService,
    );

    await expect(service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS)).rejects.toThrow(
      'Vendedor MOCK-0001 não encontrado',
    );
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
