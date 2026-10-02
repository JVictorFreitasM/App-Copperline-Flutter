import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
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
const TABELA_PRECO_PADRAO = { idVendaProdutoExterno: 'tabela-venda-externo-1' };
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

  // Guarda de regressao: desconto de estoque acontece em OUTRA etapa do
  // fluxo da empresa (fora deste sistema), nunca aqui - ver teste dedicado
  // "nunca toca em SaldoEstoque/EstoqueLote" abaixo. Espioes explicitos
  // (em vez de deixar as chaves ausentes) pra falhar com mensagem clara
  // ("expected... not to have been called") se algum dia alguem tentar
  // decrementar estoque na criacao de pedido, em vez de um TypeError
  // criptico de "undefined nao e uma funcao".
  const saldoEstoqueUpdate = jest.fn();
  const saldoEstoqueUpsert = jest.fn();
  const estoqueLoteUpdate = jest.fn();
  const estoqueLoteUpsert = jest.fn();

  const tx = {
    pedido: { create: pedidoCreate },
    pedidoItem: { createMany: pedidoItemCreateMany },
    solicitacaoDesconto: { update: solicitacaoDescontoUpdate },
    pedidoHistoricoStatus: { create: pedidoHistoricoStatusCreate },
    saldoEstoque: { update: saldoEstoqueUpdate, upsert: saldoEstoqueUpsert },
    estoqueLote: { update: estoqueLoteUpdate, upsert: estoqueLoteUpsert },
  };

  // Fora de qualquer transacao de proposito - ver
  // CriarPedidoService.atualizarCabecalhoAposEnvio (best-effort, roda
  // depois que a transacao de criacao ja commitou).
  const pedidoUpdate = jest.fn().mockResolvedValue(undefined);
  // Marcacao por alcada de cada item (marcarItensPorAlcada) - fora da tx.
  const pedidoItemFindMany = jest
    .fn()
    .mockResolvedValue([{ id: 'item-1', percentualDesconto: { toNumber: () => 10 } }]);
  const pedidoItemUpdate = jest.fn().mockResolvedValue(undefined);

  return {
    pedidoItem: { findMany: pedidoItemFindMany, update: pedidoItemUpdate },
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
    pedido: { update: pedidoUpdate },
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
  return {
    avaliarDesconto: jest.fn().mockResolvedValue(avaliacao),
    exigeAprovacao: jest.fn().mockResolvedValue(true),
  };
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
  // Best-effort (ver PedidoErpClientService.buscarCabecalhoAtualizado) -
  // resolve null por padrao (equivalente a "Radar ainda nao processou" ou
  // falha de rede), que e' um caminho ja tratado sem lancar.
  const buscarCabecalhoAtualizado = jest.fn().mockResolvedValue(null);
  return { criar, buscarCabecalhoAtualizado };
}

function configuracaoTabelaPrecoServiceFake(codigo: string | null = '110') {
  return { obterCodigoSelecionado: jest.fn().mockResolvedValue(codigo) };
}

function configuracaoRastreioServiceFake(
  overrides: {
    distanciaMaximaClienteRegistroPedidoMetros?: number | null;
    permitirRegistroComGpsDesabilitado?: boolean;
  } = {},
) {
  return {
    obter: jest.fn().mockResolvedValue({
      desabilitarEdicaoHorarioTrabalhoAndroid: true,
      habilitarRastreamentoSabados: false,
      habilitarRastreamentoDomingos: false,
      horarioInicioRastreamento: '07:30',
      horarioTerminoRastreamento: '18:00',
      precisaoMinimaMetrosGps: 50,
      tempoMinimoAcordarGpsMs: 30000,
      permitirRegistroComGpsDesabilitado: overrides.permitirRegistroComGpsDesabilitado ?? false,
      distanciaMaximaClienteRegistroPedidoMetros:
        overrides.distanciaMaximaClienteRegistroPedidoMetros ?? null,
      distanciaMaximaClienteRegistroVisitaMetros: 50,
      atualizadoEm: '2026-01-01T00:00:00.000Z',
    }),
  };
}

// Helper - monta os 6 argumentos do construtor com fakes padrao, so
// sobrescrevendo o que o teste precisa (a maioria dos testes so mexe nos
// 2-3 primeiros).
function configuracaoOrcamentoServiceFake(
  overrides: {
    habilitarCriacaoOrcamento?: boolean;
    permitirVendedorTransformarEmPedido?: boolean;
    permitirAlteracaoVendedorOrcamentoCriado?: boolean;
    permitirItensRepetidos?: boolean;
  } = {},
) {
  return {
    obter: jest.fn().mockResolvedValue({
      habilitarCriacaoOrcamento: overrides.habilitarCriacaoOrcamento ?? true,
      permitirVendedorTransformarEmPedido: overrides.permitirVendedorTransformarEmPedido ?? true,
      criarPedidoSugeridoComoOrcamento: true,
      permitirAlteracaoVendedorOrcamentoCriado:
        overrides.permitirAlteracaoVendedorOrcamentoCriado ?? true,
      permitirItensRepetidos: overrides.permitirItensRepetidos ?? false,
      atualizadoEm: '2026-01-01T00:00:00.000Z',
    }),
  };
}

function criarService(
  prisma: ReturnType<typeof prismaFake>,
  produtoCalculoService = produtoCalculoServiceFake(),
  solicitacoesDescontoService = solicitacoesDescontoServiceFake(),
  pedidoErpClientService = pedidoErpClientServiceFake(),
  configuracaoTabelaPrecoService = configuracaoTabelaPrecoServiceFake(),
  configuracaoRastreioService = configuracaoRastreioServiceFake(),
  configuracaoOrcamentoService = configuracaoOrcamentoServiceFake(),
) {
  return new CriarPedidoService(
    prisma as never,
    produtoCalculoService as never,
    solicitacoesDescontoService as never,
    pedidoErpClientService as never,
    configuracaoTabelaPrecoService as never,
    configuracaoRastreioService as never,
    configuracaoOrcamentoService as never,
  );
}

const INPUT_BASE: CriarPedidoInput = {
  clienteId: 'cliente-1',
  formaPagamentoId: 'forma-1',
  condicaoPagamentoId: 'condicao-1',
  itens: [{ produtoId: 'produto-1', metrosDesejados: 90, percentualDesconto: 10 }],
};

describe('CriarPedidoService.criar', () => {
  // Guarda de dados (pedido explicito do usuario, 2026-09-23): o web ja
  // evita duplicata na UI (abre o item existente pra edicao), mas a API
  // tem que rejeitar de qualquer client (mobile, chamada direta). Roda
  // ANTES de qualquer consulta ao banco - rejeita cedo, sem gastar
  // trabalho com um pedido que ja sabe que vai falhar.
  it('lanca BadRequestException quando o mesmo produto aparece duas vezes no pedido, sem consultar o vendedor antes', async () => {
    const prisma = prismaFake();
    const service = criarService(prisma);
    const inputComDuplicata: CriarPedidoInput = {
      ...INPUT_BASE,
      itens: [
        { produtoId: 'produto-1', metrosDesejados: 90, percentualDesconto: 10 },
        { produtoId: 'produto-1', metrosDesejados: 50, percentualDesconto: 0 },
      ],
    };

    await expect(
      service.criar(inputComDuplicata, 'u1', ESCOPO_TODOS),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.vendedor.findFirst).not.toHaveBeenCalled();
  });

  // 2026-09-24 - ConfiguracaoOrcamento.permitirItensRepetidos ligado
  // (aba "Orcamento" da tela de Configuracoes) pula a guarda acima por
  // completo, aceitando o mesmo produtoId mais de uma vez.
  it('nao lanca excecao de duplicata quando permitirItensRepetidos esta ligado', async () => {
    const prisma = prismaFake();
    const service = criarService(
      prisma,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      configuracaoOrcamentoServiceFake({ permitirItensRepetidos: true }),
    );
    const inputComDuplicata: CriarPedidoInput = {
      ...INPUT_BASE,
      itens: [
        { produtoId: 'produto-1', metrosDesejados: 90, percentualDesconto: 10 },
        { produtoId: 'produto-1', metrosDesejados: 50, percentualDesconto: 0 },
      ],
    };

    await expect(
      service.criar(inputComDuplicata, 'u1', ESCOPO_TODOS),
    ).resolves.toBeDefined();
  });

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

  // Guarda de regressao (pedido explicito do usuario, 2026-09-22): o
  // desconto de saldo em estoque acontece em OUTRA etapa do fluxo da
  // empresa (fora deste sistema) - CriarPedidoService NUNCA deve escrever
  // em SaldoEstoque/EstoqueLote, nem no caminho de sucesso (ENVIADO) nem
  // quando cai em aprovacao (AGUARDANDO_APROVACAO). As duas tabelas so
  // sao escritas pelas sync strategies (SaldoEstoqueSyncStrategy/
  // EstoqueLoteSyncStrategy), nunca por um fluxo de pedido.
  it('nunca toca em SaldoEstoque/EstoqueLote ao criar pedido - desconto de estoque e outra etapa do fluxo, fora deste sistema', async () => {
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

    await service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS);

    expect(prisma._tx.saldoEstoque.update).not.toHaveBeenCalled();
    expect(prisma._tx.saldoEstoque.upsert).not.toHaveBeenCalled();
    expect(prisma._tx.estoqueLote.update).not.toHaveBeenCalled();
    expect(prisma._tx.estoqueLote.upsert).not.toHaveBeenCalled();
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

  it('monta o payload do ERP com os IDs externos resolvidos, valorUnitario LIQUIDO por item e percentual 0', async () => {
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
      percentualDesconto: 0, // desconto nunca vai pro Radar - so' o valor liquido
      itens: [
        {
          produtoIdExterno: 'produto-externo-1',
          idTabelaPreco: 'tabela-venda-externo-1',
          quantidade: 3,
          valorUnitario: 27, // LIQUIDO: 30 bruto - 10% de desconto do item
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

  // Pedido do usuario (2026-09-28): "numero"/situacao/datas do pedido so
  // existem no Radar depois que ele termina de processar a criacao (POST
  // devolve so {id, codigoIntegrador}) - busca isso de volta logo apos
  // enviar, em vez de esperar o sync noturno/manual.
  it('busca e grava numero/situacao/datas do Radar logo apos enviar o pedido', async () => {
    const prisma = prismaFake();
    const pedidoErpClientService = pedidoErpClientServiceFake();
    pedidoErpClientService.buscarCabecalhoAtualizado.mockResolvedValue({
      numero: '0724-000999',
      situacao: 'EM_ANALISE',
      dataEmissao: new Date('2026-09-28'),
      dataHoraUltimaAlteracao: new Date('2026-09-28T10:00:00Z'),
    });
    const service = criarService(
      prisma,
      undefined,
      solicitacoesDescontoServiceFake(),
      pedidoErpClientService,
    );

    await service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS);

    expect(pedidoErpClientService.buscarCabecalhoAtualizado).toHaveBeenCalledWith('erp-1');
    expect(prisma.pedido.update).toHaveBeenCalledWith({
      where: { id: 'pedido-1' },
      data: {
        numero: '0724-000999',
        situacao: 'EM_ANALISE',
        dataEmissao: new Date('2026-09-28'),
        dataHoraUltimaAlteracao: new Date('2026-09-28T10:00:00Z'),
      },
    });
  });

  // Best-effort: Radar pode ainda nao ter processado (buscarCabecalhoAtualizado
  // resolve null, ver mock padrao) - nao pode quebrar a criacao do pedido.
  it('nao falha a criacao quando a busca de cabecalho pos-envio nao retorna nada', async () => {
    const prisma = prismaFake();
    const pedidoErpClientService = pedidoErpClientServiceFake();
    const service = criarService(
      prisma,
      undefined,
      solicitacoesDescontoServiceFake(),
      pedidoErpClientService,
    );

    const resultado = await service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS);

    expect(resultado.status).toBe('ENVIADO');
    expect(prisma.pedido.update).not.toHaveBeenCalled();
  });

  // 2026-09-21 - WK Radar rejeitou ValorUnitario com mais de 2 casas
  // decimais ("nao permite mais de 2 casas decimais"); precoVenda por
  // metro (ver ProdutoCalculoService.resolverPrecoVenda, preco por KM
  // convertido) pode chegar aqui com ate 6 casas.
  it('arredonda valorUnitario a 2 casas decimais no payload do ERP', async () => {
    const prisma = prismaFake();
    const produtoCalculoService = produtoCalculoServiceFake({
      quantidade: 3,
      unidade: 'METRO',
      valorUnitario: 3.079998,
      valorFinal: 8.32,
    });
    const pedidoErpClientService = pedidoErpClientServiceFake();
    const service = criarService(
      prisma,
      produtoCalculoService,
      solicitacoesDescontoServiceFake(),
      pedidoErpClientService,
    );

    await service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS);

    expect(pedidoErpClientService.criar).toHaveBeenCalledWith(
      expect.objectContaining({
        // 3 metros -> 0.003 km no payload do ERP (ver teste dedicado
        // abaixo pra um caso mais realista, 1000 metros -> 1 km).
        // valorUnitario precisa estar na MESMA unidade de quantidade (KM,
        // nao metro) - bug corrigido 2026-09-28, reportado pelo usuario:
        // 3.079998/metro * 1000 = 3079.998/km, menos 10% de desconto =
        // 2771.9982, arredondado pra 2772 (preco LIQUIDO, ver enviarAoErp).
        itens: [expect.objectContaining({ quantidade: 0.003, valorUnitario: 2772 })],
      }),
    );
  });

  // 2026-09-21 - achado a partir do bug reportado pelo usuario ("quantidade
  // aparece em metros, deveria ser km"): quantidadeVenda persistido E o
  // payload do ERP precisam estar em KM pra item METRO/retalho (confirmado
  // cruzando dados reais do Radar - quantidadeVenda de pedidos sincronizados
  // vem sempre fracionario pequeno, nunca inteiro grande tipo "1000") -
  // internamente item.quantidade continua em METROS (calculo de peso,
  // subtotal bruto), só a conversao pro externo (ERP + coluna
  // quantidadeVenda) que muda.
  it('converte quantidade de metros pra KM no quantidadeVenda persistido e no payload do ERP (item METRO)', async () => {
    const prisma = prismaFake();
    const produtoCalculoService = produtoCalculoServiceFake({
      quantidade: 1000, // 1km convertido pra metros na chamada do calculo
      unidade: 'METRO',
      valorUnitario: 3.08,
      valorFinal: 3079.98,
    });
    const pedidoErpClientService = pedidoErpClientServiceFake();
    const service = criarService(
      prisma,
      produtoCalculoService,
      solicitacoesDescontoServiceFake(),
      pedidoErpClientService,
    );

    await service.criar(
      { ...INPUT_BASE, itens: [{ produtoId: 'produto-1', metrosDesejados: 1000, percentualDesconto: 0 }] },
      'u1',
      ESCOPO_TODOS,
    );

    expect(pedidoErpClientService.criar).toHaveBeenCalledWith(
      expect.objectContaining({ itens: [expect.objectContaining({ quantidade: 1 })] }),
    );
    expect(prisma._tx.pedidoItem.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ quantidadeVenda: 1, unidade: 'METRO' })],
    });
  });

  it('NAO converte quantidade de item PECA (contagem de pecas, nao metros)', async () => {
    const prisma = prismaFake();
    const service = criarService(prisma); // default fake: unidade PECA, quantidade 3

    await service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS);

    expect(prisma._tx.pedidoItem.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ quantidadeVenda: 3, unidade: 'PECA' })],
    });
  });

  // 2026-09-21 - observacoes agora e' campo do PEDIDO (nao mais so por
  // item, ver CriarPedidoItemDto.observacoes/PedidoItem.observacoes,
  // conceito separado ja existente).
  it('persiste observacoes no PEDIDO (nao so por item)', async () => {
    const prisma = prismaFake();
    const service = criarService(prisma);

    await service.criar(
      { ...INPUT_BASE, observacoes: 'entregar pela manha' },
      'u1',
      ESCOPO_TODOS,
    );

    expect(prisma._tx.pedido.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ observacoes: 'entregar pela manha' }),
      }),
    );
  });

  it('observacoes omitido: persiste null no pedido', async () => {
    const prisma = prismaFake();
    const service = criarService(prisma);

    await service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS);

    expect(prisma._tx.pedido.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ observacoes: null }),
      }),
    );
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

  // Achado 2026-09-17: idExternoErp (SOAP) e idVendaProdutoExterno (REST)
  // sao namespaces DIFERENTES de ID no Radar - so' o REST e' valido pro
  // payload de POST /comercial/v1/pedido. Confirmado testando contra o
  // ambiente real ("Id invalido" quando mandamos o SOAP por engano).
  it('tabela sincronizada mas sem idVendaProdutoExterno (REST) ainda: falha antes de chamar o ERP', async () => {
    const prisma = prismaFake({ tabelaPreco: { idVendaProdutoExterno: null } });
    const service = criarService(prisma);

    await expect(service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS)).rejects.toThrow(
      /ainda não tem o ID de venda \(REST\) sincronizado/,
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

  it('desconto excede a alcada gerencial: propaga o erro, nao persiste nada local nem chama o ERP (Epico 4)', async () => {
    const prisma = prismaFake();
    const produtoCalculoService = produtoCalculoServiceFake();
    const solicitacoesDescontoService = {
      avaliarDesconto: jest
        .fn()
        .mockRejectedValue(
          new UnprocessableEntityException(
            'Desconto de 60% excede o teto da alcada gerencial (50%)',
          ),
        ),
      exigeAprovacao: jest.fn().mockResolvedValue(true),
    };
    const pedidoErpClientService = pedidoErpClientServiceFake();
    const service = criarService(
      prisma,
      produtoCalculoService,
      solicitacoesDescontoService,
      pedidoErpClientService,
    );

    await expect(service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS)).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(pedidoErpClientService.criar).not.toHaveBeenCalled();
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

function decimalFake(valor: number) {
  return { toNumber: () => valor, toString: () => String(valor) };
}

describe('CriarPedidoService - distancia maxima pra registro de pedido (Epico 4)', () => {
  it('sem distanciaMaximaClienteRegistroPedidoMetros configurada: nao exige nem valida lat/lng', async () => {
    const prisma = prismaFake();
    const service = criarService(
      prisma,
      undefined,
      undefined,
      undefined,
      undefined,
      configuracaoRastreioServiceFake({ distanciaMaximaClienteRegistroPedidoMetros: null }),
    );

    await service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS);

    expect(prisma._tx.pedido.create).toHaveBeenCalled();
  });

  it('com distancia configurada e lat/lng dentro do raio: cria normalmente', async () => {
    const prisma = prismaFake({
      cliente: {
        id: 'cliente-1',
        idExternoErp: 'cliente-externo-1',
        localizacaoLat: decimalFake(-23.5505),
        localizacaoLng: decimalFake(-46.6333),
      },
    });
    const service = criarService(
      prisma,
      undefined,
      undefined,
      undefined,
      undefined,
      configuracaoRastreioServiceFake({ distanciaMaximaClienteRegistroPedidoMetros: 500 }),
    );

    await service.criar(
      { ...INPUT_BASE, latitude: -23.5505, longitude: -46.6333 },
      'u1',
      ESCOPO_TODOS,
    );

    expect(prisma._tx.pedido.create).toHaveBeenCalled();
  });

  it('com distancia configurada e lat/lng fora do raio: rejeita com BadRequestException', async () => {
    const prisma = prismaFake({
      cliente: {
        id: 'cliente-1',
        idExternoErp: 'cliente-externo-1',
        localizacaoLat: decimalFake(-23.5505),
        localizacaoLng: decimalFake(-46.6333),
      },
    });
    const service = criarService(
      prisma,
      undefined,
      undefined,
      undefined,
      undefined,
      configuracaoRastreioServiceFake({ distanciaMaximaClienteRegistroPedidoMetros: 50 }),
    );

    await expect(
      service.criar({ ...INPUT_BASE, latitude: -23.56, longitude: -46.6333 }, 'u1', ESCOPO_TODOS),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('distancia configurada, sem lat/lng, permitirRegistroComGpsDesabilitado ligado: passa direto', async () => {
    const prisma = prismaFake({
      cliente: {
        id: 'cliente-1',
        idExternoErp: 'cliente-externo-1',
        localizacaoLat: decimalFake(-23.5505),
        localizacaoLng: decimalFake(-46.6333),
      },
    });
    const service = criarService(
      prisma,
      undefined,
      undefined,
      undefined,
      undefined,
      configuracaoRastreioServiceFake({
        distanciaMaximaClienteRegistroPedidoMetros: 50,
        permitirRegistroComGpsDesabilitado: true,
      }),
    );

    await service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS);

    expect(prisma._tx.pedido.create).toHaveBeenCalled();
  });

  it('distancia configurada, sem lat/lng, permitirRegistroComGpsDesabilitado desligado: rejeita', async () => {
    const prisma = prismaFake();
    const service = criarService(
      prisma,
      undefined,
      undefined,
      undefined,
      undefined,
      configuracaoRastreioServiceFake({
        distanciaMaximaClienteRegistroPedidoMetros: 50,
        permitirRegistroComGpsDesabilitado: false,
      }),
    );

    await expect(service.criar(INPUT_BASE, 'u1', ESCOPO_TODOS)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('distancia configurada, lat/lng enviados, cliente sem pin: rejeita com UnprocessableEntityException', async () => {
    const prisma = prismaFake({
      cliente: {
        id: 'cliente-1',
        idExternoErp: 'cliente-externo-1',
        localizacaoLat: null,
        localizacaoLng: null,
      },
    });
    const service = criarService(
      prisma,
      undefined,
      undefined,
      undefined,
      undefined,
      configuracaoRastreioServiceFake({ distanciaMaximaClienteRegistroPedidoMetros: 50 }),
    );

    await expect(
      service.criar({ ...INPUT_BASE, latitude: -23.5505, longitude: -46.6333 }, 'u1', ESCOPO_TODOS),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
