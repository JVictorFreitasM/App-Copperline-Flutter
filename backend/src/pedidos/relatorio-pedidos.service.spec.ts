import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RelatorioPedidosService } from './relatorio-pedidos.service';

const IDP_USER = { sub: 's1', email: 'a@a.com', name: 'A', role: null, system: 'x' };

function vendedorEscopoServiceFake(escopo: Record<string, unknown> = { tipo: 'TODOS' }) {
  return { resolverEscopoVendedores: jest.fn().mockResolvedValue(escopo) };
}

function decimalFake(valor: number) {
  return { toNumber: () => valor, toString: () => String(valor) };
}

function pedidoBruto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ped-1',
    numero: '123',
    situacao: null,
    statusLocal: 'AGUARDANDO_APROVACAO',
    dataHoraUltimaAlteracao: new Date(),
    valorTotal: decimalFake(1000),
    vendedorId: 'v1',
    cliente: { id: 'c1', razaoSocial: 'Cliente X' },
    solicitacoesDesconto: [{ status: 'PENDENTE' }],
    ...overrides,
  };
}

function prismaFake(overrides: {
  vendedores?: Record<string, unknown>[];
  pedidosPeriodo?: Record<string, unknown>[];
  pedidosAguardando?: Record<string, unknown>[];
} = {}) {
  const vendedores = overrides.vendedores ?? [{ id: 'v1', nome: 'Vendedor Um' }];
  return {
    vendedor: {
      findMany: jest.fn().mockResolvedValue(vendedores),
    },
    pedido: {
      findMany: jest.fn().mockImplementation(
        async (args: { where: { statusLocal?: string } }) =>
          'statusLocal' in args.where
            ? (overrides.pedidosAguardando ?? [])
            : (overrides.pedidosPeriodo ?? [pedidoBruto()]),
      ),
    },
  };
}

describe('RelatorioPedidosService.obter', () => {
  it('lanca ForbiddenException quando o escopo e PROPRIO (VENDEDOR comum)', async () => {
    const prisma = prismaFake();
    const service = new RelatorioPedidosService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'PROPRIO', vendedorId: 'v1' }) as never,
    );

    await expect(service.obter(IDP_USER as never, 'u1', {})).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lanca ForbiddenException quando o escopo e NENHUM', async () => {
    const prisma = prismaFake();
    const service = new RelatorioPedidosService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'NENHUM' }) as never,
    );

    await expect(service.obter(IDP_USER as never, 'u1', {})).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lanca NotFoundException quando o vendedorId do filtro esta fora da equipe (anti-IDOR)', async () => {
    const prisma = prismaFake();
    const service = new RelatorioPedidosService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'EQUIPE', vendedorIds: ['v1'] }) as never,
    );

    await expect(
      service.obter(IDP_USER as never, 'u-sup', { vendedorId: 'fora-da-equipe' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('agrupa pedidos por vendedor, incluindo vendedor sem nenhum pedido no periodo', async () => {
    const prisma = prismaFake({
      vendedores: [
        { id: 'v1', nome: 'Vendedor Um' },
        { id: 'v2', nome: 'Vendedor Dois' },
      ],
      pedidosPeriodo: [pedidoBruto({ vendedorId: 'v1' })],
    });
    const service = new RelatorioPedidosService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'EQUIPE', vendedorIds: ['v1', 'v2'] }) as never,
    );

    const resultado = await service.obter(IDP_USER as never, 'u-sup', {});

    const v1 = resultado.vendedores.find((v) => v.vendedorId === 'v1')!;
    const v2 = resultado.vendedores.find((v) => v.vendedorId === 'v2')!;
    expect(v1.totalPedidos).toBe(1);
    expect(v2.totalPedidos).toBe(0);
    expect(v2.pedidos).toEqual([]);
  });

  it('usa "hoje" como periodo quando nenhuma data e informada', async () => {
    const prisma = prismaFake();
    const service = new RelatorioPedidosService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'TODOS' }) as never,
    );
    const hoje = new Date().toISOString().slice(0, 10);

    const resultado = await service.obter(IDP_USER as never, 'u-admin', {});

    expect(resultado.periodo).toEqual({ dataInicial: hoje, dataFinal: hoje });
  });

  it('respeita o periodo explicito quando informado', async () => {
    const prisma = prismaFake();
    const service = new RelatorioPedidosService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'TODOS' }) as never,
    );

    const resultado = await service.obter(IDP_USER as never, 'u-admin', {
      dataInicial: '2026-01-01',
      dataFinal: '2026-01-31',
    });

    expect(resultado.periodo).toEqual({ dataInicial: '2026-01-01', dataFinal: '2026-01-31' });
  });

  it('deriva statusAprovacao PENDENTE e calcula dias/destaque quando aguardando aprovacao ha mais de 1 dia', async () => {
    const tresDiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const prisma = prismaFake({
      pedidosPeriodo: [
        pedidoBruto({
          dataHoraUltimaAlteracao: tresDiasAtras,
          solicitacoesDesconto: [{ status: 'PENDENTE' }],
        }),
      ],
    });
    const service = new RelatorioPedidosService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'TODOS' }) as never,
    );

    const resultado = await service.obter(IDP_USER as never, 'u-admin', {});

    const item = resultado.vendedores[0].pedidos[0];
    expect(item.statusAprovacao).toBe('PENDENTE');
    expect(item.diasPendente).toBe(3);
    expect(item.destaquePendenciaAntiga).toBe(true);
  });

  it('nao destaca pendencia com menos de 1 dia', async () => {
    const prisma = prismaFake({
      pedidosPeriodo: [
        pedidoBruto({
          dataHoraUltimaAlteracao: new Date(),
          solicitacoesDesconto: [{ status: 'PENDENTE' }],
        }),
      ],
    });
    const service = new RelatorioPedidosService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'TODOS' }) as never,
    );

    const resultado = await service.obter(IDP_USER as never, 'u-admin', {});

    expect(resultado.vendedores[0].pedidos[0].destaquePendenciaAntiga).toBe(false);
  });

  it('pedido com solicitacao APROVADA nao conta mais como PENDENTE (some da visao de pendentes)', async () => {
    const prisma = prismaFake({
      pedidosPeriodo: [pedidoBruto({ solicitacoesDesconto: [{ status: 'APROVADO' }] })],
      pedidosAguardando: [
        { vendedorId: 'v1', solicitacoesDesconto: [{ status: 'APROVADO' }] },
      ],
    });
    const service = new RelatorioPedidosService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'TODOS' }) as never,
    );

    const resultado = await service.obter(IDP_USER as never, 'u-admin', {});

    expect(resultado.vendedores[0].pedidos[0].statusAprovacao).toBe('APROVADO');
    expect(resultado.vendedores[0].pendentesAtuais).toBe(0);
  });

  it('pendentesAtuais conta o backlog atual independente do filtro de periodo da listagem', async () => {
    const prisma = prismaFake({
      pedidosPeriodo: [],
      pedidosAguardando: [
        { vendedorId: 'v1', solicitacoesDesconto: [{ status: 'PENDENTE' }] },
        { vendedorId: 'v1', solicitacoesDesconto: [{ status: 'PENDENTE' }] },
      ],
    });
    const service = new RelatorioPedidosService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'TODOS' }) as never,
    );

    const resultado = await service.obter(IDP_USER as never, 'u-admin', {
      dataInicial: '2020-01-01',
      dataFinal: '2020-01-02',
    });

    expect(resultado.vendedores[0].totalPedidos).toBe(0);
    expect(resultado.vendedores[0].pendentesAtuais).toBe(2);
  });

  it('filtra por status quando informado', async () => {
    const prisma = prismaFake({
      pedidosPeriodo: [
        pedidoBruto({ id: 'ped-pendente', solicitacoesDesconto: [{ status: 'PENDENTE' }] }),
        pedidoBruto({ id: 'ped-enviado', statusLocal: 'ENVIADO', solicitacoesDesconto: [] }),
      ],
    });
    const service = new RelatorioPedidosService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'TODOS' }) as never,
    );

    const resultado = await service.obter(IDP_USER as never, 'u-admin', { status: 'ENVIADO' });

    expect(resultado.vendedores[0].pedidos.map((p) => p.id)).toEqual(['ped-enviado']);
  });

  it('pedido sem pipeline de aprovacao (statusLocal null - so sincronizado do ERP) tem statusAprovacao null', async () => {
    const prisma = prismaFake({
      pedidosPeriodo: [pedidoBruto({ statusLocal: null, solicitacoesDesconto: [] })],
    });
    const service = new RelatorioPedidosService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'TODOS' }) as never,
    );

    const resultado = await service.obter(IDP_USER as never, 'u-admin', {});

    expect(resultado.vendedores[0].pedidos[0].statusAprovacao).toBeNull();
    expect(resultado.vendedores[0].pedidos[0].diasPendente).toBeNull();
  });
});
