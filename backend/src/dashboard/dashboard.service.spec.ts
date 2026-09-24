import { DashboardService } from './dashboard.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';

// Epico 1.2 (filtro "Equipe") - todos os testes existentes assumiam
// acesso irrestrito, comportamento que corresponde a ESCOPO_TODOS
// (equivalente a admin/sem filtro) - testes dedicados de EQUIPE/PROPRIO/
// NENHUM ficam nos describe blocks novos, mais abaixo.
const ESCOPO_TODOS: EscopoClientes = { tipo: 'TODOS' };

function prismaFake(overrides: {
  clientesAtivos?: number;
  produtosAtivos?: number;
  pedidosEmAberto?: number;
  somaFaturado?: unknown;
  pedidosRecentes?: unknown[];
  notasFiscaisRecentes?: unknown[];
  pedidoAggregate?: unknown;
  pedidoGroupBy?: unknown[];
  pedidoItemGroupBy?: unknown[];
  notaFiscalAggregate?: unknown;
  notaFiscalGroupBy?: unknown[];
  clientes?: unknown[];
  produtos?: unknown[];
  saldosEstoque?: unknown[];
  vinculosClienteVendedor?: unknown[];
  vendedores?: unknown[];
  pedidoCount?: number;
  notasFiscais?: unknown[];
}) {
  return {
    cliente: {
      count: jest.fn().mockResolvedValue(overrides.clientesAtivos ?? 0),
      findMany: jest.fn().mockResolvedValue(overrides.clientes ?? []),
    },
    produto: {
      count: jest.fn().mockResolvedValue(overrides.produtosAtivos ?? 0),
      findMany: jest.fn().mockResolvedValue(overrides.produtos ?? []),
    },
    clienteVendedor: {
      findMany: jest.fn().mockResolvedValue(overrides.vinculosClienteVendedor ?? []),
    },
    vendedor: {
      findMany: jest.fn().mockResolvedValue(overrides.vendedores ?? []),
    },
    pedido: {
      count: jest.fn().mockResolvedValue(overrides.pedidoCount ?? overrides.pedidosEmAberto ?? 0),
      aggregate: jest.fn().mockResolvedValue(
        overrides.pedidoAggregate ?? { _count: 0, _sum: { valorTotal: overrides.somaFaturado ?? null } },
      ),
      groupBy: jest.fn().mockResolvedValue(overrides.pedidoGroupBy ?? []),
      findMany: jest.fn().mockResolvedValue(overrides.pedidosRecentes ?? []),
    },
    pedidoItem: {
      groupBy: jest.fn().mockResolvedValue(overrides.pedidoItemGroupBy ?? []),
    },
    notaFiscal: {
      aggregate: jest.fn().mockResolvedValue(
        overrides.notaFiscalAggregate ?? { _sum: { valorTotalNotaFiscal: null } },
      ),
      groupBy: jest.fn().mockResolvedValue(overrides.notaFiscalGroupBy ?? []),
      findMany: jest
        .fn()
        .mockResolvedValue(overrides.notasFiscaisRecentes ?? overrides.notasFiscais ?? []),
    },
    saldoEstoque: {
      findMany: jest.fn().mockResolvedValue(overrides.saldosEstoque ?? []),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

describe('DashboardService.obterResumo', () => {
  it('agrega contagens e soma de valor faturado nos ultimos 30 dias', async () => {
    const prisma = prismaFake({
      clientesAtivos: 42,
      produtosAtivos: 17,
      pedidosEmAberto: 5,
      somaFaturado: { toString: () => '1500.50' },
    });
    const service = new DashboardService(prisma as never);

    const resumo = await service.obterResumo();

    expect(resumo.clientesAtivos).toBe(42);
    expect(resumo.produtosAtivos).toBe(17);
    expect(resumo.pedidosEmAberto).toBe(5);
    expect(resumo.valorFaturadoRecente).toBe('1500.50');
    expect(resumo.periodoValorFaturadoDias).toBe(30);
  });

  it('devolve "0" como valor faturado quando nao ha nenhum pedido faturado no periodo', async () => {
    const prisma = prismaFake({});
    const service = new DashboardService(prisma as never);

    const resumo = await service.obterResumo();

    expect(resumo.valorFaturadoRecente).toBe('0');
  });

  it('conta pedidos em aberto so com as situacoes nao-finalizadas', async () => {
    const prisma = prismaFake({});
    const service = new DashboardService(prisma as never);

    await service.obterResumo();

    expect(prisma.pedido.count).toHaveBeenCalledWith({
      where: {
        situacao: {
          in: [
            'EM_ANALISE',
            'BLOQUEADO',
            'PENDENTE',
            'PARCIALMENTE_FATURADO',
            'PARCIALMENTE_ATENDIDO',
          ],
        },
      },
    });
  });
});

describe('DashboardService.obterVendas', () => {
  it('calcula ticketMedio dividindo valorTotal por totalPedidos', async () => {
    const prisma = prismaFake({
      pedidoAggregate: { _count: 4, _sum: { valorTotal: { toString: () => '1000' } } },
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterVendas({}, ESCOPO_TODOS);

    expect(resultado.totalPedidos).toBe(4);
    expect(resultado.valorTotal).toBe('1000');
    expect(resultado.ticketMedio).toBe('250.00');
  });

  it('ticketMedio fica "0" quando nao ha pedidos no periodo (nunca divide por zero)', async () => {
    const prisma = prismaFake({ pedidoAggregate: { _count: 0, _sum: { valorTotal: null } } });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterVendas({}, ESCOPO_TODOS);

    expect(resultado.ticketMedio).toBe('0');
  });

  it('aplica o filtro de periodo em dataHoraUltimaAlteracao', async () => {
    const prisma = prismaFake({});
    const service = new DashboardService(prisma as never);

    await service.obterVendas({ dataInicial: '2026-01-01', dataFinal: '2026-01-31' }, ESCOPO_TODOS);

    expect(prisma.pedido.aggregate).toHaveBeenCalledWith(
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

  // Epico 1.2 (filtro "Equipe") - o mesmo `where` de escopo ja usado em
  // Pedido/Cliente (VendedorEscopoService) precisa chegar aqui tambem,
  // mesclado com o filtro de periodo - representativo dos outros 6
  // metodos que passaram pela mesma mudanca (ranking/notas-fiscais/funil/
  // vendas-por-estado/vendas-vs-faturado/comparativo-mensal).
  it('mescla o where de escopo EQUIPE com o filtro de periodo', async () => {
    const prisma = prismaFake({});
    const service = new DashboardService(prisma as never);

    await service.obterVendas({}, { tipo: 'EQUIPE', vendedorIds: ['v1', 'v2'] });

    expect(prisma.pedido.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          cliente: { vendedores: { some: { vendedorId: { in: ['v1', 'v2'] } } } },
          dataHoraUltimaAlteracao: undefined,
        },
      }),
    );
  });

  // Escopo NENHUM = "nenhum pedido nunca bate" - retorna vazio SEM
  // consultar o banco (mesmo criterio ja usado em PedidosService), nunca
  // um erro nem um numero inventado.
  it('escopo NENHUM retorna vendas zeradas sem consultar o Prisma', async () => {
    const prisma = prismaFake({});
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterVendas({}, { tipo: 'NENHUM' });

    expect(resultado.totalPedidos).toBe(0);
    expect(resultado.valorTotal).toBe('0');
    expect(prisma.pedido.aggregate).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('DashboardService.obterFunilPedidos', () => {
  it('monta as etapas do funil a partir da contagem real por situacao', async () => {
    const prisma = prismaFake({
      pedidoGroupBy: [
        { situacao: 'EM_ANALISE', _count: 3 },
        { situacao: 'ATENDIDO', _count: 5 },
        { situacao: 'CANCELADO', _count: 1 },
      ],
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterFunilPedidos({}, ESCOPO_TODOS);

    expect(resultado.etapas).toEqual([
      { etapa: 'Criado', quantidade: 9 },
      { etapa: 'Em processamento', quantidade: 3 },
      { etapa: 'Atendimento parcial', quantidade: 0 },
      { etapa: 'Concluído', quantidade: 5 },
    ]);
    expect(resultado.cancelados).toBe(1);
  });

  it('retorna tudo zerado sem lancar excecao quando nao ha pedido no periodo', async () => {
    const prisma = prismaFake({ pedidoGroupBy: [] });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterFunilPedidos(
      { dataInicial: '1900-01-01', dataFinal: '1900-01-02' },
      ESCOPO_TODOS,
    );

    expect(resultado.etapas.every((e) => e.quantidade === 0)).toBe(true);
  });
});

describe('DashboardService.obterRanking', () => {
  // OS-WEB-29 - criterio de aceite: periodo sem nenhum pedido/pedidoItem
  // (groupBy vazio) nao lanca excecao, so retorna listas vazias.
  it('retorna topClientes/topProdutos vazios quando o periodo nao tem nenhum registro', async () => {
    const prisma = prismaFake({ pedidoGroupBy: [], pedidoItemGroupBy: [] });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterRanking(
      { dataInicial: '1900-01-01', dataFinal: '1900-01-02', limite: 10 },
      ESCOPO_TODOS,
    );

    expect(resultado.topClientes).toEqual([]);
    expect(resultado.topProdutos).toEqual([]);
    expect(resultado.topVendedores).toEqual([]);
  });

  it('resolve nome do cliente/produto pros ids agrupados', async () => {
    const prisma = prismaFake({
      pedidoGroupBy: [{ clienteId: 'c1', _sum: { valorTotal: { toString: () => '500' } } }],
      pedidoItemGroupBy: [{ produtoId: 'p1', _sum: { valorTotal: { toString: () => '300' } } }],
      clientes: [{ id: 'c1', razaoSocial: 'Cliente Um', nomeFantasia: null }],
      produtos: [{ id: 'p1', nome: 'Produto Um', codigo: 'COD-1' }],
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterRanking({ limite: 10 }, ESCOPO_TODOS);

    expect(resultado.topClientes).toEqual([{ id: 'c1', nome: 'Cliente Um', valorTotal: '500' }]);
    expect(resultado.topProdutos).toEqual([{ id: 'p1', nome: 'Produto Um', valorTotal: '300' }]);
  });

  it('soma o valor de todos os clientes vinculados a um vendedor pro ranking de top vendedores', async () => {
    const prisma = prismaFake({
      pedidoGroupBy: [
        { clienteId: 'c1', _sum: { valorTotal: { toString: () => '500' } } },
        { clienteId: 'c2', _sum: { valorTotal: { toString: () => '300' } } },
      ],
      clientes: [
        { id: 'c1', razaoSocial: 'Cliente Um', nomeFantasia: null },
        { id: 'c2', razaoSocial: 'Cliente Dois', nomeFantasia: null },
      ],
      vinculosClienteVendedor: [
        { clienteId: 'c1', vendedorId: 'v1' },
        { clienteId: 'c2', vendedorId: 'v1' },
      ],
      vendedores: [{ id: 'v1', nome: 'Vendedor Um' }],
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterRanking({ limite: 10 }, ESCOPO_TODOS);

    expect(resultado.topVendedores).toEqual([{ id: 'v1', nome: 'Vendedor Um', valorTotal: '800' }]);
  });

  it('cliente sem vinculo de vendedor nao contribui pro ranking de vendedores (sem inventar atribuicao)', async () => {
    const prisma = prismaFake({
      pedidoGroupBy: [{ clienteId: 'c1', _sum: { valorTotal: { toString: () => '500' } } }],
      clientes: [{ id: 'c1', razaoSocial: 'Cliente Um', nomeFantasia: null }],
      vinculosClienteVendedor: [],
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterRanking({ limite: 10 }, ESCOPO_TODOS);

    expect(resultado.topVendedores).toEqual([]);
  });

  it('usa o primeiro vinculo (mais antigo) quando o schema permite mais de um vendedor por cliente', async () => {
    const prisma = prismaFake({
      pedidoGroupBy: [{ clienteId: 'c1', _sum: { valorTotal: { toString: () => '500' } } }],
      clientes: [{ id: 'c1', razaoSocial: 'Cliente Um', nomeFantasia: null }],
      // findMany ja ordenado por criadoEm asc (mesmo comportamento do
      // orderBy passado ao Prisma real) - v1 e' o mais antigo.
      vinculosClienteVendedor: [
        { clienteId: 'c1', vendedorId: 'v1' },
        { clienteId: 'c1', vendedorId: 'v2' },
      ],
      vendedores: [{ id: 'v1', nome: 'Vendedor Antigo' }],
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterRanking({ limite: 10 }, ESCOPO_TODOS);

    expect(resultado.topVendedores).toEqual([{ id: 'v1', nome: 'Vendedor Antigo', valorTotal: '500' }]);
  });
});

describe('DashboardService.obterNotasFiscais', () => {
  // OS-WEB-29 - mesmo criterio de obterRanking: periodo sem nenhuma nota
  // fiscal nao lanca excecao, so "0"/lista vazia.
  it('valorFaturado fica "0" e contagemPorStatus vazia quando nao ha nota fiscal no periodo', async () => {
    const prisma = prismaFake({
      notaFiscalAggregate: { _sum: { valorTotalNotaFiscal: null } },
      notaFiscalGroupBy: [],
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterNotasFiscais(
      { dataInicial: '1900-01-01', dataFinal: '1900-01-02' },
      ESCOPO_TODOS,
    );

    expect(resultado.valorFaturado).toBe('0');
    expect(resultado.contagemPorStatus).toEqual([]);
  });

  it('soma valorTotalNotaFiscal e agrupa por statusNfe no periodo', async () => {
    const prisma = prismaFake({
      notaFiscalAggregate: { _sum: { valorTotalNotaFiscal: { toString: () => '2500' } } },
      notaFiscalGroupBy: [{ statusNfe: 'AUTORIZADA', _count: 3 }],
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterNotasFiscais({}, ESCOPO_TODOS);

    expect(resultado.valorFaturado).toBe('2500');
    expect(resultado.contagemPorStatus).toEqual([{ status: 'AUTORIZADA', quantidade: 3 }]);
  });
});

describe('DashboardService.obterEstoqueCritico', () => {
  it('so lista produto com saldo baixo E pelo menos 1 pedido pendente referenciando ele', async () => {
    const prisma = prismaFake({
      saldosEstoque: [
        { codigoProduto: 'COD-BAIXO-SEM-PEDIDO', quantidadeDisponivel: { toString: () => '2' } },
        { codigoProduto: 'COD-BAIXO-COM-PEDIDO', quantidadeDisponivel: { toString: () => '0' } },
      ],
      produtos: [
        { id: 'p-sem-pedido', nome: 'Sem pedido', codigo: 'COD-BAIXO-SEM-PEDIDO' },
        { id: 'p-com-pedido', nome: 'Com pedido', codigo: 'COD-BAIXO-COM-PEDIDO' },
      ],
      pedidoItemGroupBy: [{ produtoId: 'p-com-pedido', _count: 2 }],
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterEstoqueCritico({ limiar: 10 });

    expect(resultado.produtos).toHaveLength(1);
    expect(resultado.produtos[0]).toEqual({
      produtoId: 'p-com-pedido',
      nome: 'Com pedido',
      codigo: 'COD-BAIXO-COM-PEDIDO',
      quantidadeDisponivel: '0',
      quantidadePedidosPendentes: 2,
    });
  });

  it('filtra pedido pendente so entre as situacoes em aberto', async () => {
    const prisma = prismaFake({
      saldosEstoque: [{ codigoProduto: 'COD-1', quantidadeDisponivel: { toString: () => '1' } }],
      produtos: [{ id: 'p1', nome: 'Produto 1', codigo: 'COD-1' }],
      pedidoItemGroupBy: [],
    });
    const service = new DashboardService(prisma as never);

    await service.obterEstoqueCritico({ limiar: 10 });

    expect(prisma.pedidoItem.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          pedido: {
            situacao: {
              in: [
                'EM_ANALISE',
                'BLOQUEADO',
                'PENDENTE',
                'PARCIALMENTE_FATURADO',
                'PARCIALMENTE_ATENDIDO',
              ],
            },
          },
        }),
      }),
    );
  });

  it('retorna lista vazia quando nao ha nenhum saldo abaixo do limiar', async () => {
    const prisma = prismaFake({ saldosEstoque: [] });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterEstoqueCritico({ limiar: 10 });

    expect(resultado.produtos).toEqual([]);
  });
});

function decimalFake(valor: number) {
  return { toNumber: () => valor };
}

describe('DashboardService.obterMapaCalorVendas', () => {
  it('so inclui cliente com pin de localizacao definido, mesmo com pedido no periodo', async () => {
    const prisma = prismaFake({
      pedidoGroupBy: [
        { clienteId: 'com-pin', _sum: { valorTotal: { toString: () => '500' } } },
        { clienteId: 'sem-pin', _sum: { valorTotal: { toString: () => '300' } } },
      ],
      clientes: [
        {
          id: 'com-pin',
          razaoSocial: 'Cliente Com Pin',
          nomeFantasia: null,
          localizacaoLat: decimalFake(-23.55),
          localizacaoLng: decimalFake(-46.63),
        },
      ],
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterMapaCalorVendas({});

    expect(resultado.pontos).toHaveLength(1);
    expect(resultado.pontos[0].clienteId).toBe('com-pin');
    expect(resultado.pontos[0].valorTotal).toBe(500);
    expect(resultado.totalClientesNoPeriodo).toBe(2);
  });

  it('sem nenhum pedido no periodo, nao consulta cliente', async () => {
    const prisma = prismaFake({ pedidoGroupBy: [] });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterMapaCalorVendas({});

    expect(resultado.pontos).toEqual([]);
    expect(resultado.totalClientesNoPeriodo).toBe(0);
    expect(prisma.cliente.findMany).not.toHaveBeenCalled();
  });
});

// OS-dashboard-configuracoes-notificacoes-auditoria.md, Epico 2.
describe('DashboardService.obterComparativoMensal', () => {
  it('soma valorTotal por mes, separando ano atual do ano anterior', async () => {
    const prisma = prismaFake({
      pedidosRecentes: [
        { dataHoraUltimaAlteracao: new Date(Date.UTC(2026, 0, 15)), valorTotal: 100 },
        { dataHoraUltimaAlteracao: new Date(Date.UTC(2026, 0, 20)), valorTotal: 50 },
        { dataHoraUltimaAlteracao: new Date(Date.UTC(2025, 0, 10)), valorTotal: 80 },
        { dataHoraUltimaAlteracao: new Date(Date.UTC(2026, 5, 1)), valorTotal: 30 },
      ],
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterComparativoMensal({ ano: 2026 }, ESCOPO_TODOS);

    expect(resultado.anoAtual).toBe(2026);
    expect(resultado.anoAnterior).toBe(2025);
    expect(resultado.meses[0]).toEqual({
      mes: 1,
      valorAnoAtual: '150',
      valorAnoAnterior: '80',
    });
    expect(resultado.meses[5]).toEqual({
      mes: 6,
      valorAnoAtual: '30',
      valorAnoAnterior: '0',
    });
    expect(resultado.meses).toHaveLength(12);
  });

  it('usa o ano corrente quando nenhum ano e informado', async () => {
    const prisma = prismaFake({ pedidosRecentes: [] });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterComparativoMensal({}, ESCOPO_TODOS);

    expect(resultado.anoAtual).toBe(new Date().getFullYear());
  });
});

// OS-dashboard-configuracoes-notificacoes-auditoria.md, Epico 1.2.
describe('DashboardService.obterVendasPorEstado', () => {
  it('mapeia valor/quantidade por UF e expoe quantidadePedidosSemUf separado', async () => {
    const prisma = prismaFake({
      pedidoGroupBy: [
        { ufEntrega: 'MA', _sum: { valorTotal: 1000 }, _count: 3 },
        { ufEntrega: 'PI', _sum: { valorTotal: 500 }, _count: 1 },
      ],
      pedidoCount: 42,
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterVendasPorEstado({}, ESCOPO_TODOS);

    expect(resultado.estados).toEqual([
      { uf: 'MA', valorTotal: '1000', quantidadePedidos: 3 },
      { uf: 'PI', valorTotal: '500', quantidadePedidos: 1 },
    ]);
    expect(resultado.quantidadePedidosSemUf).toBe(42);
    expect(prisma.pedido.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ufEntrega: { not: null } }) }),
    );
  });
});

// OS-dashboard-configuracoes-notificacoes-auditoria.md, Epico 1.2 - "Vendas
// x Faturado".
describe('DashboardService.obterVendasVsFaturado', () => {
  it('agrupa vendido (Pedido) e faturado (NotaFiscal) pelo mesmo mes, independente', async () => {
    const prisma = prismaFake({
      pedidosRecentes: [
        { dataHoraUltimaAlteracao: new Date(Date.UTC(2026, 0, 5)), valorTotal: 100 },
        { dataHoraUltimaAlteracao: new Date(Date.UTC(2026, 1, 5)), valorTotal: 50 },
      ],
      notasFiscais: [
        { dataEmissao: new Date(Date.UTC(2026, 0, 10)), valorTotalNotaFiscal: 60 },
      ],
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterVendasVsFaturado({}, ESCOPO_TODOS);

    expect(resultado.meses).toEqual([
      { mes: '2026-01', valorVendido: '100', valorFaturado: '60' },
      { mes: '2026-02', valorVendido: '50', valorFaturado: '0' },
    ]);
  });

  it('sem nenhum pedido/nota no periodo, devolve lista de meses vazia', async () => {
    const prisma = prismaFake({ pedidosRecentes: [], notasFiscais: [] });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterVendasVsFaturado({}, ESCOPO_TODOS);

    expect(resultado.meses).toEqual([]);
  });
});

// OS-dashboard-configuracoes-notificacoes-auditoria.md, Epico 1.1 - 3 cards
// de KPI do topo do painel.
describe('DashboardService.obterKpis', () => {
  function prismaFakeKpis(overrides: {
    orcamentosCount?: number;
    orcamentosSoma?: number | null;
    aprovadosCount?: number;
    aprovadosMedia?: number | null;
    ultimoPedidoPorCliente?: { clienteId: string | null; _max: { dataHoraUltimaAlteracao: Date | null } }[];
    clientesAtivosSemPedidoRecente?: number;
  }) {
    return {
      cliente: {
        count: jest.fn().mockResolvedValue(overrides.clientesAtivosSemPedidoRecente ?? 0),
      },
      pedido: {
        aggregate: jest.fn().mockImplementation((args: { where?: { statusLocal?: string } }) => {
          if (args?.where?.statusLocal === 'ORCAMENTO') {
            return Promise.resolve({
              _count: overrides.orcamentosCount ?? 0,
              _sum: { valorTotal: overrides.orcamentosSoma ?? null },
            });
          }
          return Promise.resolve({
            _count: overrides.aprovadosCount ?? 0,
            _avg: { valorTotal: overrides.aprovadosMedia ?? null },
          });
        }),
        groupBy: jest.fn().mockResolvedValue(overrides.ultimoPedidoPorCliente ?? []),
      },
    };
  }

  it('conta orcamentos abertos (statusLocal ORCAMENTO) e soma o valor total', async () => {
    const prisma = prismaFakeKpis({ orcamentosCount: 4, orcamentosSoma: 12000 });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterKpis();

    expect(resultado.orcamentosAbertos).toEqual({ quantidade: 4, valorTotal: '12000' });
  });

  it('calcula ticket medio como media dos pedidos aprovados (FATURADO/ATENDIDO)', async () => {
    const prisma = prismaFakeKpis({ aprovadosCount: 10, aprovadosMedia: 250.5 });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterKpis();

    expect(resultado.ticketMedioVendas).toEqual({ valor: '250.5', quantidadePedidos: 10 });
  });

  it('conta clientes ativos sem pedido aprovado ha mais de 30 dias e projeta valor potencial pelo ticket medio geral', async () => {
    const cortado = new Date();
    cortado.setDate(cortado.getDate() - 45);
    const recente = new Date();
    recente.setDate(recente.getDate() - 5);

    const prisma = prismaFakeKpis({
      aprovadosMedia: 300,
      ultimoPedidoPorCliente: [
        { clienteId: 'cliente-inativo', _max: { dataHoraUltimaAlteracao: cortado } },
        { clienteId: 'cliente-recente', _max: { dataHoraUltimaAlteracao: recente } },
      ],
      clientesAtivosSemPedidoRecente: 1,
    });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterKpis();

    expect(prisma.cliente.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['cliente-inativo'] }, inativo: false }),
      }),
    );
    expect(resultado.clientesSemPedidoRecente).toEqual({
      quantidade: 1,
      valorPotencial: '300',
      diasSemPedido: 30,
    });
  });

  it('nao chama cliente.count quando nenhum cliente esta sem pedido recente', async () => {
    const prisma = prismaFakeKpis({ ultimoPedidoPorCliente: [] });
    const service = new DashboardService(prisma as never);

    const resultado = await service.obterKpis();

    expect(prisma.cliente.count).not.toHaveBeenCalled();
    expect(resultado.clientesSemPedidoRecente).toEqual({
      quantidade: 0,
      valorPotencial: '0',
      diasSemPedido: 30,
    });
  });
});
