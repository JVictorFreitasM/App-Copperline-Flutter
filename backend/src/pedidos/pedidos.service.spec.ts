import { NotFoundException } from '@nestjs/common';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';
import { PedidosService } from './pedidos.service';

const ESCOPO_TODOS: EscopoClientes = { tipo: 'TODOS' };
const ESCOPO_PROPRIO: EscopoClientes = { tipo: 'PROPRIO', vendedorId: 'vend-1' };
const ESCOPO_NENHUM: EscopoClientes = { tipo: 'NENHUM' };

function prismaFake(overrides: {
  findMany?: unknown[];
  count?: number;
  findFirst?: unknown;
  historico?: unknown[];
  updateManyCount?: number;
}) {
  return {
    pedido: {
      findMany: jest.fn().mockResolvedValue(overrides.findMany ?? []),
      count: jest.fn().mockResolvedValue(overrides.count ?? 0),
      findFirst: jest.fn().mockResolvedValue(overrides.findFirst ?? null),
    },
    pedidoItem: {
      updateMany: jest.fn().mockResolvedValue({ count: overrides.updateManyCount ?? 1 }),
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
      vendedorRadar: null,
      solicitacoesDesconto: [],
    };
    const prisma = prismaFake({ findMany: [pedidoBruto], count: 1 });
    const service = new PedidosService(prisma as never);

    const resultado = await service.listar({ page: 1, limit: 20 }, ESCOPO_TODOS);

    expect(resultado.data[0].cliente).toEqual({
      id: 'cli-1',
      razaoSocial: 'Cliente A',
    });
    expect(
      (resultado.data[0] as unknown as Record<string, unknown>).itens,
    ).toBeUndefined();
  });

  it('marca temSolicitacaoDescontoPendente quando existe solicitacao PENDENTE vinculada (icone de exclamacao)', async () => {
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
      vendedorRadar: null,
      solicitacoesDesconto: [{ id: 'sol-1' }],
    };
    const prisma = prismaFake({ findMany: [pedidoBruto], count: 1 });
    const service = new PedidosService(prisma as never);

    const resultado = await service.listar({ page: 1, limit: 20 }, ESCOPO_TODOS);

    expect(resultado.data[0].temSolicitacaoDescontoPendente).toBe(true);
    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          solicitacoesDesconto: { where: { status: 'PENDENTE' }, take: 1 },
        }),
      }),
    );
  });

  // Achado 2026-09-28 (pedido do usuario: "nome do vendedor nao aparece,
  // mesmo enviado ao Radar") - pedido criado localmente so tem vendedorId
  // (vendedor), vendedorRadarId fica null ate' sincronizar de volta (pode
  // nunca acontecer). paraPedidoResumoDto precisa cair pro vendedor local
  // quando nao ha' vendedorRadar.
  it('usa o vendedor local (Pedido.vendedorId) como fallback quando nao ha vendedorRadar', async () => {
    const pedidoBruto = {
      id: '1',
      idExternoErp: null,
      numero: null,
      situacao: null,
      dataHoraUltimaAlteracao: null,
      valorTotal: { toString: () => '150.00' },
      incompleto: false,
      sincronizadoEm: new Date('2026-01-01'),
      cliente: { id: 'cli-1', razaoSocial: 'Cliente A' },
      vendedorRadar: null,
      vendedor: { id: 'vend-1', nome: 'Vendedor Local', email: 'v@x.com', whatsapp: null },
      solicitacoesDesconto: [],
    };
    const prisma = prismaFake({ findMany: [pedidoBruto], count: 1 });
    const service = new PedidosService(prisma as never);

    const resultado = await service.listar({ page: 1, limit: 20 }, ESCOPO_TODOS);

    expect(resultado.data[0].vendedor).toEqual({
      id: 'vend-1',
      nome: 'Vendedor Local',
      email: 'v@x.com',
      whatsapp: null,
    });
  });

  it('filtra por clienteId e situacao quando informados', async () => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new PedidosService(prisma as never);

    await service.listar(
      { page: 1, limit: 20, clienteId: 'cli-1', situacao: 'FATURADO' },
      ESCOPO_TODOS,
    );

    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{}, { clienteId: 'cli-1' }, { situacao: 'FATURADO' }] },
      }),
    );
  });

  it('filtra por clienteNome (razaoSocial/nomeFantasia) quando informado', async () => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new PedidosService(prisma as never);

    await service.listar({ page: 1, limit: 20, clienteNome: 'Acme' }, ESCOPO_TODOS);

    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {},
            {
              cliente: {
                OR: [
                  { razaoSocial: { contains: 'Acme', mode: 'insensitive' } },
                  { nomeFantasia: { contains: 'Acme', mode: 'insensitive' } },
                ],
              },
            },
          ],
        },
      }),
    );
  });

  it('filtra por periodo (dataInicial/dataFinal) sobre dataHoraUltimaAlteracao', async () => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new PedidosService(prisma as never);

    await service.listar(
      { page: 1, limit: 20, dataInicial: '2026-01-01', dataFinal: '2026-01-31' },
      ESCOPO_TODOS,
    );

    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {},
            {
              dataHoraUltimaAlteracao: {
                gte: new Date('2026-01-01'),
                lte: new Date('2026-01-31T23:59:59.999Z'),
              },
            },
          ],
        },
      }),
    );
  });

  it('escopo PROPRIO filtra pelo vendedor do CLIENTE (nao Pedido.vendedorId, que fica null em pedido sincronizado)', async () => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new PedidosService(prisma as never);

    await service.listar({ page: 1, limit: 20 }, ESCOPO_PROPRIO);

    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ cliente: { vendedores: { some: { vendedorId: 'vend-1' } } } }],
        },
      }),
    );
  });

  // Achado desta rodada (IDOR): antes, escopo (EQUIPE/PROPRIO) e
  // clienteNome usavam a MESMA chave `cliente` num spread de objeto - a
  // segunda sobrescrevia a primeira, deixando um vendedor comum buscar por
  // nome de cliente SEM nenhuma restricao de carteira. `AND: [...]` (ver
  // construirWhereListagem) corrige isso - os dois where.cliente ficam em
  // itens separados do array, nunca se sobrescrevem.
  it('SEGURANCA: escopo PROPRIO + clienteNome combinam via AND, sem a restricao de carteira ser descartada', async () => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new PedidosService(prisma as never);

    await service.listar(
      { page: 1, limit: 20, clienteNome: 'Acme' },
      ESCOPO_PROPRIO,
    );

    const { where } = prisma.pedido.findMany.mock.calls[0][0] as {
      where: { AND: Record<string, unknown>[] };
    };
    expect(where.AND).toContainEqual({
      cliente: { vendedores: { some: { vendedorId: 'vend-1' } } },
    });
    expect(where.AND).toContainEqual({
      cliente: {
        OR: [
          { razaoSocial: { contains: 'Acme', mode: 'insensitive' } },
          { nomeFantasia: { contains: 'Acme', mode: 'insensitive' } },
        ],
      },
    });
  });

  it('filtra por vendedorId (Equipe) - fica dentro do AND, escopo continua se aplicando junto', async () => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new PedidosService(prisma as never);

    await service.listar({ page: 1, limit: 20, vendedorId: 'vend-2' }, ESCOPO_TODOS);

    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{}, { cliente: { vendedores: { some: { vendedorId: 'vend-2' } } } }],
        },
      }),
    );
  });

  it.each([
    ['NAO_INTEGRADO', { idExternoErp: null, statusLocal: { not: 'ORCAMENTO' } }],
    ['AGUARDANDO_APROVACAO', { statusLocal: 'AGUARDANDO_APROVACAO' }],
    ['ENVIADO', { OR: [{ statusLocal: 'ENVIADO' }, { idExternoErp: { not: null } }] }],
    ['ORCAMENTO', { statusLocal: 'ORCAMENTO' }],
  ] as const)('filtra por statusAprovacao=%s', async (valor, condicaoEsperada) => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new PedidosService(prisma as never);

    await service.listar({ page: 1, limit: 20, statusAprovacao: valor }, ESCOPO_TODOS);

    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{}, condicaoEsperada] } }),
    );
  });

  it('filtra por ufEntrega (Localizacao), normalizando pra maiusculo', async () => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new PedidosService(prisma as never);

    await service.listar({ page: 1, limit: 20, ufEntrega: 'mg' }, ESCOPO_TODOS);

    expect(prisma.pedido.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [{}, { ufEntrega: 'MG' }] } }),
    );
  });

  it('escopo NENHUM retorna lista vazia sem consultar o banco', async () => {
    const prisma = prismaFake({ findMany: [{ id: 'nao deveria aparecer' }], count: 1 });
    const service = new PedidosService(prisma as never);

    const resultado = await service.listar({ page: 1, limit: 20 }, ESCOPO_NENHUM);

    expect(resultado.data).toEqual([]);
    expect(resultado.meta.total).toBe(0);
    expect(prisma.pedido.findMany).not.toHaveBeenCalled();
  });
});

describe('PedidosService.contarPorStatusAprovacao', () => {
  function prismaContadoresFake(naoIntegrados: number, aguardandoAprovacao: number, orcamentos = 0) {
    const count = jest
      .fn()
      .mockResolvedValueOnce(naoIntegrados)
      .mockResolvedValueOnce(aguardandoAprovacao)
      .mockResolvedValueOnce(orcamentos);
    return {
      pedido: { count },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
  }

  it('retorna os tres contadores dos atalhos rapidos da listagem', async () => {
    const prisma = prismaContadoresFake(68, 5599, 12);
    const service = new PedidosService(prisma as never);

    const resultado = await service.contarPorStatusAprovacao(ESCOPO_TODOS);

    expect(resultado).toEqual({ naoIntegrados: 68, aguardandoAprovacao: 5599, orcamentos: 12 });
  });

  it('escopo NENHUM retorna zero pros tres sem consultar o banco', async () => {
    const prisma = prismaContadoresFake(999, 999, 999);
    const service = new PedidosService(prisma as never);

    const resultado = await service.contarPorStatusAprovacao(ESCOPO_NENHUM);

    expect(resultado).toEqual({ naoIntegrados: 0, aguardandoAprovacao: 0, orcamentos: 0 });
    expect(prisma.pedido.count).not.toHaveBeenCalled();
  });
});

describe('PedidosService.buscarPorId', () => {
  it('lança NotFoundException quando o pedido nao existe (ou nao esta no escopo)', async () => {
    const prisma = prismaFake({ findFirst: null });
    const service = new PedidosService(prisma as never);

    await expect(
      service.buscarPorId('inexistente', ESCOPO_TODOS),
    ).rejects.toThrow(NotFoundException);
  });

  it('lança NotFoundException sem consultar o banco quando o escopo e NENHUM', async () => {
    const prisma = prismaFake({ findFirst: { id: '1' } });
    const service = new PedidosService(prisma as never);

    await expect(service.buscarPorId('1', ESCOPO_NENHUM)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.pedido.findFirst).not.toHaveBeenCalled();
  });

  it('aplica o where de escopo junto do id (vendedor comum nao ve pedido de cliente fora da carteira)', async () => {
    const prisma = prismaFake({ findFirst: null });
    const service = new PedidosService(prisma as never);

    await expect(
      service.buscarPorId('pedido-de-outro', ESCOPO_PROPRIO),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.pedido.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'pedido-de-outro',
          cliente: { vendedores: { some: { vendedorId: 'vend-1' } } },
        },
      }),
    );
  });

  it('mapeia itens com resumo de produto no detalhe', async () => {
    const prisma = prismaFake({
      findFirst: {
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
            statusAprovacao: 'PENDENTE',
            decididoPor: null,
            decididoEm: null,
          },
        ],
      },
    });
    const service = new PedidosService(prisma as never);

    const resultado = await service.buscarPorId('1', ESCOPO_TODOS);

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
        produto: {
          id: 'prod-1',
          nome: 'Produto A',
          codigo: 'P1',
          pesoLiquidoKg: null,
          pesoBrutoKg: null,
        },
        statusAprovacao: 'PENDENTE',
        decididoPor: null,
        decididoEm: null,
      },
    ]);
  });

  // Achado 2026-09-17: pedido criado localmente (forma/condicao/tabela/
  // contato/vendedor escolhidos na criacao) aparecia em branco na tela de
  // detalhe mesmo com o dado salvo no banco - PEDIDO_DETALHE_INCLUDE nunca
  // buscava essas relacoes.
  it('mapeia formaPagamento/condicaoPagamento/codigoTabelaPreco/contato/vendedorResponsavel no detalhe', async () => {
    const prisma = prismaFake({
      findFirst: {
        id: '1',
        idExternoErp: null,
        numero: null,
        situacao: null,
        dataHoraUltimaAlteracao: null,
        valorTotal: null,
        incompleto: false,
        sincronizadoEm: new Date('2026-01-01'),
        cliente: null,
        itens: [],
        codigoTabelaPreco: '110',
        formaPagamento: { id: 'forma-1', codigo: '06', descricao: 'BOLETO' },
        condicaoPagamento: { id: 'condicao-1', codigo: '30', nome: '30 DIAS' },
        contato: {
          id: 'contato-1',
          nome: 'Fulano',
          telefoneDdd: '11',
          telefoneNumero: '999999999',
        },
        vendedor: { id: 'vendedor-1', nome: 'José Gabriel' },
        historicoStatus: [{ alteradoEm: new Date('2026-09-17T12:00:00.000Z') }],
      },
    });
    const service = new PedidosService(prisma as never);

    const resultado = await service.buscarPorId('1', ESCOPO_TODOS);

    expect(resultado.codigoTabelaPreco).toBe('110');
    expect(resultado.formaPagamento).toEqual({ id: 'forma-1', codigo: '06', descricao: 'BOLETO' });
    expect(resultado.condicaoPagamento).toEqual({ id: 'condicao-1', codigo: '30', nome: '30 DIAS' });
    expect(resultado.contato).toEqual({
      id: 'contato-1',
      nome: 'Fulano',
      telefoneDdd: '11',
      telefoneNumero: '999999999',
    });
    expect(resultado.vendedorResponsavel).toEqual({ id: 'vendedor-1', nome: 'José Gabriel' });
    expect(resultado.horarioEnvio).toEqual(new Date('2026-09-17T12:00:00.000Z'));
  });

  it('horarioEnvio fica null quando o pedido nunca teve transicao pra ENVIADO (sincronizado do Radar ou aguardando aprovacao)', async () => {
    const prisma = prismaFake({
      findFirst: {
        id: '1',
        idExternoErp: 'ext-1',
        numero: 'PED-1',
        situacao: null,
        dataHoraUltimaAlteracao: null,
        valorTotal: null,
        incompleto: false,
        sincronizadoEm: new Date('2026-01-01'),
        cliente: null,
        itens: [],
        historicoStatus: [],
      },
    });
    const service = new PedidosService(prisma as never);

    const resultado = await service.buscarPorId('1', ESCOPO_TODOS);

    expect(resultado.horarioEnvio).toBeNull();
  });
});

const PEDIDO_DETALHE_BASE = {
  id: '1',
  idExternoErp: 'ext-1',
  numero: 'PED-1',
  situacao: 'PENDENTE',
  dataHoraUltimaAlteracao: null,
  valorTotal: null,
  incompleto: false,
  sincronizadoEm: new Date('2026-01-01'),
  cliente: null,
  itens: [],
};

describe('PedidosService.aprovarItem/rejeitarItem (revisao por item)', () => {
  it('lança NotFoundException quando o pedido nao esta no escopo, sem tocar no item', async () => {
    const prisma = prismaFake({ findFirst: null });
    const service = new PedidosService(prisma as never);

    await expect(
      service.aprovarItem('pedido-1', 'item-1', 'usuario-1', ESCOPO_PROPRIO),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.pedidoItem.updateMany).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando o item nao pertence ao pedido (updateMany atinge 0 linhas)', async () => {
    const prisma = prismaFake({ findFirst: { id: '1' }, updateManyCount: 0 });
    const service = new PedidosService(prisma as never);

    await expect(
      service.aprovarItem('1', 'item-de-outro-pedido', 'usuario-1', ESCOPO_TODOS),
    ).rejects.toThrow(NotFoundException);
  });

  it('aprova um item especifico e devolve o pedido atualizado', async () => {
    const prisma = prismaFake({ findFirst: PEDIDO_DETALHE_BASE });
    const service = new PedidosService(prisma as never);

    const resultado = await service.aprovarItem('1', 'item-1', 'usuario-1', ESCOPO_TODOS);

    expect(prisma.pedidoItem.updateMany).toHaveBeenCalledWith({
      where: { id: 'item-1', pedidoId: '1' },
      data: expect.objectContaining({
        statusAprovacao: 'APROVADO',
        decididoPorId: 'usuario-1',
      }),
    });
    expect(resultado.id).toBe('1');
  });

  it('rejeita um item especifico', async () => {
    const prisma = prismaFake({ findFirst: PEDIDO_DETALHE_BASE });
    const service = new PedidosService(prisma as never);

    await service.rejeitarItem('1', 'item-1', 'usuario-1', ESCOPO_TODOS);

    expect(prisma.pedidoItem.updateMany).toHaveBeenCalledWith({
      where: { id: 'item-1', pedidoId: '1' },
      data: expect.objectContaining({
        statusAprovacao: 'REJEITADO',
        decididoPorId: 'usuario-1',
      }),
    });
  });
});

describe('PedidosService.aprovarTodosItens/rejeitarTodosItens (Aprovar tudo/Reprovar tudo)', () => {
  it('lança NotFoundException quando o pedido nao esta no escopo', async () => {
    const prisma = prismaFake({ findFirst: null });
    const service = new PedidosService(prisma as never);

    await expect(
      service.aprovarTodosItens('pedido-1', 'usuario-1', ESCOPO_PROPRIO),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.pedidoItem.updateMany).not.toHaveBeenCalled();
  });

  it('aprova todos os itens do pedido de uma vez, sem filtrar por id de item', async () => {
    const prisma = prismaFake({ findFirst: PEDIDO_DETALHE_BASE });
    const service = new PedidosService(prisma as never);

    await service.aprovarTodosItens('1', 'usuario-1', ESCOPO_TODOS);

    expect(prisma.pedidoItem.updateMany).toHaveBeenCalledWith({
      where: { pedidoId: '1' },
      data: expect.objectContaining({ statusAprovacao: 'APROVADO' }),
    });
  });

  it('rejeita todos os itens do pedido de uma vez', async () => {
    const prisma = prismaFake({ findFirst: PEDIDO_DETALHE_BASE });
    const service = new PedidosService(prisma as never);

    await service.rejeitarTodosItens('1', 'usuario-1', ESCOPO_TODOS);

    expect(prisma.pedidoItem.updateMany).toHaveBeenCalledWith({
      where: { pedidoId: '1' },
      data: expect.objectContaining({ statusAprovacao: 'REJEITADO' }),
    });
  });
});

describe('PedidosService.obterHistorico', () => {
  it('lanca NotFoundException quando o pedido nao existe (ou nao esta no escopo)', async () => {
    const prisma = prismaFake({ findFirst: null });
    const service = new PedidosService(prisma as never);

    await expect(
      service.obterHistorico('inexistente', ESCOPO_TODOS),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanca NotFoundException sem consultar o banco quando o escopo e NENHUM', async () => {
    const prisma = prismaFake({ findFirst: { id: 'pedido-1' } });
    const service = new PedidosService(prisma as never);

    await expect(
      service.obterHistorico('pedido-1', ESCOPO_NENHUM),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.pedido.findFirst).not.toHaveBeenCalled();
  });

  it('retorna o historico em ordem cronologica, resolvendo o nome de quem alterou', async () => {
    const prisma = prismaFake({
      findFirst: { id: 'pedido-1' },
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

    const resultado = await service.obterHistorico('pedido-1', ESCOPO_TODOS);

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
