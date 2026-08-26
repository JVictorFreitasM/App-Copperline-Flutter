import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SolicitacoesDescontoService } from './solicitacoes-desconto.service';

function decimalFake(valor: number) {
  return { toNumber: () => valor, toString: () => String(valor) };
}

function configuracaoDescontoServiceFake(limitePercentual = 20) {
  return { obterLimitePercentual: jest.fn().mockResolvedValue(limitePercentual) };
}

function vendedorEscopoServiceFake(
  escopo: Record<string, unknown> = { tipo: 'PROPRIO', vendedorId: 'v1' },
) {
  return { resolverEscopoVendedores: jest.fn().mockResolvedValue(escopo) };
}

const IDP_USER_FAKE = { sub: 's1', email: 'a@a.com', name: 'A', role: null, system: 'x' };

function prismaFake(overrides: {
  vendedores?: Record<string, unknown>[];
  solicitacoes?: (Record<string, unknown> & {
    vendedorSolicitante?: { id: string; nome: string | null };
    pedido?: unknown;
  })[];
} = {}) {
  const vendedores = overrides.vendedores ?? [];
  const solicitacoes = overrides.solicitacoes ?? [];

  return {
    vendedor: {
      findUnique: jest
        .fn()
        .mockImplementation(async ({ where: { id } }: { where: { id: string } }) =>
          vendedores.find((v) => v.id === id) ?? null,
        ),
      findFirst: jest
        .fn()
        .mockImplementation(
          async ({ where: { usuarioId } }: { where: { usuarioId: string } }) =>
            vendedores.find((v) => v.usuarioId === usuarioId) ?? null,
        ),
    },
    solicitacaoDesconto: {
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'sol-1',
        pedidoId: data.pedidoId ?? null,
        percentualSolicitado: decimalFake(data.percentualSolicitado as number),
        vendedorSolicitanteId: data.vendedorSolicitanteId,
        papelExigido: data.papelExigido,
        aprovadorEsperadoId: data.aprovadorEsperadoId ?? null,
        status: 'PENDENTE',
        aprovadorId: null,
        decididoEm: null,
        criadoEm: new Date('2026-01-01T00:00:00.000Z'),
      })),
      findUnique: jest
        .fn()
        .mockImplementation(async ({ where: { id } }: { where: { id: string } }) =>
          solicitacoes.find((s) => s.id === id) ?? null,
        ),
      findMany: jest.fn().mockImplementation(
        async ({
          where,
        }: {
          where: { status?: string; vendedorSolicitanteId?: { in: string[] } };
        }) =>
          solicitacoes.filter((s) => {
            if (where.status && s.status !== where.status) return false;
            if (where.vendedorSolicitanteId && !where.vendedorSolicitanteId.in.includes(s.vendedorSolicitanteId as string)) {
              return false;
            }
            return true;
          }),
      ),
      update: jest.fn().mockImplementation(async ({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existente = solicitacoes.find((s) => s.id === id)!;
        return {
          ...existente,
          ...data,
          decididoEm: data.decididoEm ?? existente.decididoEm,
          criadoEm: existente.criadoEm ?? new Date('2026-01-01T00:00:00.000Z'),
        };
      }),
    },
  };
}

describe('SolicitacoesDescontoService.avaliarDesconto', () => {
  it('nao cria solicitacao quando o percentual esta dentro do limite', async () => {
    const prisma = prismaFake();
    const service = new SolicitacoesDescontoService(
      prisma as never,
      configuracaoDescontoServiceFake(20) as never,
      vendedorEscopoServiceFake() as never,
    );

    const resultado = await service.avaliarDesconto({
      vendedorSolicitanteId: 'v1',
      pedidoId: null,
      percentualSolicitado: 20,
    });

    expect(resultado).toEqual({ necessitaAprovacao: false });
    expect(prisma.solicitacaoDesconto.create).not.toHaveBeenCalled();
  });

  it('cria SolicitacaoDesconto PENDENTE quando o percentual excede o limite', async () => {
    const prisma = prismaFake({
      vendedores: [{ id: 'v1', papel: 'VENDEDOR', supervisorId: 'sup1' }],
    });
    const service = new SolicitacoesDescontoService(
      prisma as never,
      configuracaoDescontoServiceFake(20) as never,
      vendedorEscopoServiceFake() as never,
    );

    const resultado = await service.avaliarDesconto({
      vendedorSolicitanteId: 'v1',
      pedidoId: 'p1',
      percentualSolicitado: 25,
    });

    expect(resultado.necessitaAprovacao).toBe(true);
    if (resultado.necessitaAprovacao) {
      expect(resultado.solicitacao).toMatchObject({
        vendedorSolicitanteId: 'v1',
        papelExigido: 'SUPERVISOR',
        aprovadorEsperadoId: 'sup1',
        status: 'PENDENTE',
        percentualSolicitado: 25,
      });
    }
  });

  it('lanca erro claro quando o vendedor solicitante nao tem hierarquia configurada', async () => {
    const prisma = prismaFake({
      vendedores: [{ id: 'v1', papel: 'VENDEDOR', supervisorId: null }],
    });
    const service = new SolicitacoesDescontoService(
      prisma as never,
      configuracaoDescontoServiceFake(20) as never,
      vendedorEscopoServiceFake() as never,
    );

    await expect(
      service.avaliarDesconto({
        vendedorSolicitanteId: 'v1',
        pedidoId: null,
        percentualSolicitado: 30,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('lanca NotFoundException quando o vendedor solicitante nao existe', async () => {
    const prisma = prismaFake();
    const service = new SolicitacoesDescontoService(
      prisma as never,
      configuracaoDescontoServiceFake(20) as never,
      vendedorEscopoServiceFake() as never,
    );

    await expect(
      service.avaliarDesconto({
        vendedorSolicitanteId: 'inexistente',
        pedidoId: null,
        percentualSolicitado: 30,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('SolicitacoesDescontoService.aprovar/rejeitar', () => {
  function prismaComSolicitacaoPendente() {
    return prismaFake({
      vendedores: [
        { id: 'v1', usuarioId: 'u1', papel: 'VENDEDOR', supervisorId: 'sup1' },
        { id: 'sup1', usuarioId: 'u-sup', papel: 'SUPERVISOR', supervisorId: null },
        { id: 'v2', usuarioId: 'u2', papel: 'VENDEDOR', supervisorId: 'sup1' },
      ],
      solicitacoes: [
        {
          id: 'sol-1',
          pedidoId: null,
          percentualSolicitado: decimalFake(25),
          vendedorSolicitanteId: 'v1',
          papelExigido: 'SUPERVISOR',
          aprovadorEsperadoId: 'sup1',
          status: 'PENDENTE',
          aprovadorId: null,
          decididoEm: null,
          criadoEm: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });
  }

  it('aprova quando o aprovador tem papel suficiente e nao e o solicitante', async () => {
    const prisma = prismaComSolicitacaoPendente();
    const service = new SolicitacoesDescontoService(
      prisma as never,
      configuracaoDescontoServiceFake() as never,
      vendedorEscopoServiceFake() as never,
    );

    const resultado = await service.aprovar('sol-1', 'u-sup');

    expect(resultado.status).toBe('APROVADO');
    expect(resultado.aprovadorId).toBe('sup1');
  });

  it('rejeita normalmente quando autorizado', async () => {
    const prisma = prismaComSolicitacaoPendente();
    const service = new SolicitacoesDescontoService(
      prisma as never,
      configuracaoDescontoServiceFake() as never,
      vendedorEscopoServiceFake() as never,
    );

    const resultado = await service.rejeitar('sol-1', 'u-sup');

    expect(resultado.status).toBe('REJEITADO');
  });

  it('bloqueia autoaprovacao com ForbiddenException', async () => {
    const prisma = prismaComSolicitacaoPendente();
    const service = new SolicitacoesDescontoService(
      prisma as never,
      configuracaoDescontoServiceFake() as never,
      vendedorEscopoServiceFake() as never,
    );

    await expect(service.aprovar('sol-1', 'u1')).rejects.toThrow(ForbiddenException);
  });

  it('bloqueia outro vendedor no mesmo nivel (VENDEDOR) com ForbiddenException', async () => {
    const prisma = prismaComSolicitacaoPendente();
    const service = new SolicitacoesDescontoService(
      prisma as never,
      configuracaoDescontoServiceFake() as never,
      vendedorEscopoServiceFake() as never,
    );

    await expect(service.aprovar('sol-1', 'u2')).rejects.toThrow(ForbiddenException);
  });

  it('lanca ForbiddenException quando o usuario autenticado nao e um vendedor cadastrado', async () => {
    const prisma = prismaComSolicitacaoPendente();
    const service = new SolicitacoesDescontoService(
      prisma as never,
      configuracaoDescontoServiceFake() as never,
      vendedorEscopoServiceFake() as never,
    );

    await expect(service.aprovar('sol-1', 'usuario-sem-vendedor')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lanca ConflictException quando a solicitacao ja foi decidida', async () => {
    const prisma = prismaFake({
      vendedores: [{ id: 'sup1', usuarioId: 'u-sup', papel: 'SUPERVISOR', supervisorId: null }],
      solicitacoes: [
        {
          id: 'sol-1',
          pedidoId: null,
          percentualSolicitado: decimalFake(25),
          vendedorSolicitanteId: 'v1',
          papelExigido: 'SUPERVISOR',
          aprovadorEsperadoId: 'sup1',
          status: 'APROVADO',
          aprovadorId: 'sup1',
          decididoEm: new Date('2026-01-01T00:00:00.000Z'),
          criadoEm: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });
    const service = new SolicitacoesDescontoService(
      prisma as never,
      configuracaoDescontoServiceFake() as never,
      vendedorEscopoServiceFake() as never,
    );

    await expect(service.aprovar('sol-1', 'u-sup')).rejects.toThrow(ConflictException);
  });

  it('lanca NotFoundException quando a solicitacao nao existe', async () => {
    const prisma = prismaFake({
      vendedores: [{ id: 'sup1', usuarioId: 'u-sup', papel: 'SUPERVISOR', supervisorId: null }],
    });
    const service = new SolicitacoesDescontoService(
      prisma as never,
      configuracaoDescontoServiceFake() as never,
      vendedorEscopoServiceFake() as never,
    );

    await expect(service.aprovar('inexistente', 'u-sup')).rejects.toThrow(NotFoundException);
  });
});

describe('SolicitacoesDescontoService.listarPendentes', () => {
  function solicitacaoFake(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'sol-1',
      pedidoId: null,
      percentualSolicitado: decimalFake(25),
      vendedorSolicitanteId: 'v1',
      papelExigido: 'SUPERVISOR',
      aprovadorEsperadoId: 'sup1',
      status: 'PENDENTE',
      aprovadorId: null,
      decididoEm: null,
      criadoEm: new Date('2026-01-01T00:00:00.000Z'),
      vendedorSolicitante: { id: 'v1', nome: 'Vendedor Um' },
      pedido: null,
      ...overrides,
    };
  }

  it('lanca ForbiddenException quando o escopo e NENHUM (nao e vendedor cadastrado)', async () => {
    const prisma = prismaFake();
    const service = new SolicitacoesDescontoService(
      prisma as never,
      configuracaoDescontoServiceFake() as never,
      vendedorEscopoServiceFake({ tipo: 'NENHUM' }) as never,
    );

    await expect(service.listarPendentes(IDP_USER_FAKE as never, 'u1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lanca ForbiddenException quando o escopo e PROPRIO (VENDEDOR comum, sem papel de aprovacao)', async () => {
    const prisma = prismaFake();
    const service = new SolicitacoesDescontoService(
      prisma as never,
      configuracaoDescontoServiceFake() as never,
      vendedorEscopoServiceFake({ tipo: 'PROPRIO', vendedorId: 'v1' }) as never,
    );

    await expect(service.listarPendentes(IDP_USER_FAKE as never, 'u1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('escopo EQUIPE filtra so as solicitacoes da equipe (criterio: supervisor so ve a propria equipe)', async () => {
    const prisma = prismaFake({
      solicitacoes: [
        solicitacaoFake({ id: 'sol-equipe', vendedorSolicitanteId: 'v1' }),
        solicitacaoFake({ id: 'sol-fora', vendedorSolicitanteId: 'fora-da-equipe' }),
      ],
    });
    const service = new SolicitacoesDescontoService(
      prisma as never,
      configuracaoDescontoServiceFake() as never,
      vendedorEscopoServiceFake({ tipo: 'EQUIPE', vendedorIds: ['sup1', 'v1'] }) as never,
    );

    const resultado = await service.listarPendentes(IDP_USER_FAKE as never, 'u-sup');

    expect(resultado.map((r) => r.id)).toEqual(['sol-equipe']);
  });

  it('escopo TODOS (admin) nao filtra por vendedor - ve todas as pendentes', async () => {
    const prisma = prismaFake({
      solicitacoes: [
        solicitacaoFake({ id: 'sol-1', vendedorSolicitanteId: 'v1' }),
        solicitacaoFake({ id: 'sol-2', vendedorSolicitanteId: 'v2' }),
      ],
    });
    const service = new SolicitacoesDescontoService(
      prisma as never,
      configuracaoDescontoServiceFake() as never,
      vendedorEscopoServiceFake({ tipo: 'TODOS' }) as never,
    );

    const resultado = await service.listarPendentes(IDP_USER_FAKE as never, 'u-admin');

    expect(resultado.map((r) => r.id)).toEqual(['sol-1', 'sol-2']);
  });

  it('so lista status PENDENTE, nunca ja decididas', async () => {
    const prisma = prismaFake({
      solicitacoes: [
        solicitacaoFake({ id: 'sol-pendente', status: 'PENDENTE' }),
        solicitacaoFake({ id: 'sol-aprovada', status: 'APROVADO' }),
      ],
    });
    const service = new SolicitacoesDescontoService(
      prisma as never,
      configuracaoDescontoServiceFake() as never,
      vendedorEscopoServiceFake({ tipo: 'TODOS' }) as never,
    );

    const resultado = await service.listarPendentes(IDP_USER_FAKE as never, 'u-admin');

    expect(resultado.map((r) => r.id)).toEqual(['sol-pendente']);
  });

  it('inclui vendedor solicitante e pedido/cliente resolvidos no resumo', async () => {
    const prisma = prismaFake({
      solicitacoes: [
        solicitacaoFake({
          vendedorSolicitante: { id: 'v1', nome: 'Fulano' },
          pedido: {
            id: 'ped-1',
            valorTotal: decimalFake(1000),
            cliente: { id: 'c1', razaoSocial: 'Cliente X' },
          },
        }),
      ],
    });
    const service = new SolicitacoesDescontoService(
      prisma as never,
      configuracaoDescontoServiceFake() as never,
      vendedorEscopoServiceFake({ tipo: 'TODOS' }) as never,
    );

    const resultado = await service.listarPendentes(IDP_USER_FAKE as never, 'u-admin');

    expect(resultado[0].vendedorSolicitante).toEqual({ id: 'v1', nome: 'Fulano' });
    expect(resultado[0].pedido).toEqual({
      id: 'ped-1',
      valorTotal: '1000',
      cliente: { id: 'c1', razaoSocial: 'Cliente X' },
    });
  });
});
