import { ForbiddenException } from '@nestjs/common';
import { RankingEquipeService } from './ranking-equipe.service';
import { VendedorVendasService } from '../vendedores/vendedor-vendas.service';
import { VendedorEscopoService } from '../vendedores/vendedor-escopo.service';
import { ConfiguracaoGamificacaoService } from './configuracao-gamificacao.service';

const IDP_USER = { sub: 's1', email: 'a@a.com', name: 'A', role: null as string | null, system: 'x' };
const IDP_USER_ADMIN = { ...IDP_USER, role: 'admin' };

function prismaFake(overrides: {
  vendedorAtual?: unknown;
  vendedoresPorSupervisor?: unknown[];
  todosAtivos?: unknown[];
  vendedoresPorId?: Record<string, { id: string; nome: string | null }>;
}) {
  return {
    vendedor: {
      findFirst: jest
        .fn()
        .mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
          if ('usuarioId' in where) return overrides.vendedorAtual ?? null;
          if ('supervisorId' in where) return overrides.vendedoresPorSupervisor ?? [];
          return null;
        }),
      findMany: jest
        .fn()
        .mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
          if ('inativo' in where) return overrides.todosAtivos ?? [];
          if ('supervisorId' in where) return overrides.vendedoresPorSupervisor ?? [];
          if ('id' in where) {
            const ids = (where.id as { in: string[] }).in;
            return ids
              .map((id) => overrides.vendedoresPorId?.[id])
              .filter((v): v is { id: string; nome: string | null } => Boolean(v));
          }
          return [];
        }),
    },
  };
}

function vendedorVendasServiceFake(valores: Record<string, number> = {}) {
  return {
    valorVendidoPorVendedor: jest.fn().mockResolvedValue(new Map(Object.entries(valores))),
  } as unknown as VendedorVendasService;
}

function vendedorEscopoServiceFake(escopo: unknown) {
  return { resolverEscopoVendedores: jest.fn().mockResolvedValue(escopo) } as unknown as VendedorEscopoService;
}

function configuracaoGamificacaoServiceFake(visivel: boolean) {
  return {
    obterRankingVisivelParaVendedor: jest.fn().mockResolvedValue(visivel),
  } as unknown as ConfiguracaoGamificacaoService;
}

describe('RankingEquipeService.obterParaUsuario', () => {
  it('admin ve ranking de todos os vendedores ativos', async () => {
    const prisma = prismaFake({
      todosAtivos: [{ id: 'v1' }, { id: 'v2' }],
      vendedoresPorId: {
        v1: { id: 'v1', nome: 'Vendedor Um' },
        v2: { id: 'v2', nome: 'Vendedor Dois' },
      },
    });
    const service = new RankingEquipeService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'TODOS' }),
      vendedorVendasServiceFake({ v1: 100, v2: 500 }),
      configuracaoGamificacaoServiceFake(false),
    );

    const resultado = await service.obterParaUsuario(IDP_USER_ADMIN, 'u-admin', '2026-01');

    expect(resultado).toEqual([
      { vendedorId: 'v2', nome: 'Vendedor Dois', valorVendido: 500 },
      { vendedorId: 'v1', nome: 'Vendedor Um', valorVendido: 100 },
    ]);
  });

  it('lanca ForbiddenException quando o usuario nao tem vendedor vinculado', async () => {
    const prisma = prismaFake({ vendedorAtual: null });
    const service = new RankingEquipeService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'NENHUM' }),
      vendedorVendasServiceFake(),
      configuracaoGamificacaoServiceFake(false),
    );

    await expect(
      service.obterParaUsuario(IDP_USER, 'u1', '2026-01'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('supervisor ve o ranking da propria equipe (escopo EQUIPE)', async () => {
    const prisma = prismaFake({
      vendedorAtual: { id: 'sup1', papel: 'SUPERVISOR', supervisorId: null },
      vendedoresPorId: {
        sup1: { id: 'sup1', nome: 'Supervisor' },
        v1: { id: 'v1', nome: 'Vendedor Um' },
      },
    });
    const service = new RankingEquipeService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'EQUIPE', vendedorIds: ['sup1', 'v1'] }),
      vendedorVendasServiceFake({ sup1: 200, v1: 900 }),
      configuracaoGamificacaoServiceFake(false),
    );

    const resultado = await service.obterParaUsuario(IDP_USER, 'u-sup', '2026-01');

    expect(resultado.map((r) => r.vendedorId)).toEqual(['v1', 'sup1']);
  });

  it('vendedor comum sem a flag de visibilidade ligada recebe ForbiddenException', async () => {
    const prisma = prismaFake({
      vendedorAtual: { id: 'v1', papel: 'VENDEDOR', supervisorId: 'sup1' },
    });
    const service = new RankingEquipeService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'PROPRIO', vendedorId: 'v1' }),
      vendedorVendasServiceFake(),
      configuracaoGamificacaoServiceFake(false),
    );

    await expect(
      service.obterParaUsuario(IDP_USER, 'u1', '2026-01'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('vendedor comum com a flag ligada ve o ranking dos colegas (mesmo supervisorId), nao uma equipe que ele gerencia', async () => {
    const prisma = prismaFake({
      vendedorAtual: { id: 'v1', papel: 'VENDEDOR', supervisorId: 'sup1' },
      vendedoresPorSupervisor: [{ id: 'v1' }, { id: 'v2' }],
      vendedoresPorId: {
        v1: { id: 'v1', nome: 'Vendedor Um' },
        v2: { id: 'v2', nome: 'Vendedor Dois' },
      },
    });
    const service = new RankingEquipeService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'PROPRIO', vendedorId: 'v1' }),
      vendedorVendasServiceFake({ v1: 300, v2: 100 }),
      configuracaoGamificacaoServiceFake(true),
    );

    const resultado = await service.obterParaUsuario(IDP_USER, 'u1', '2026-01');

    expect(resultado.map((r) => r.vendedorId)).toEqual(['v1', 'v2']);
  });
});
