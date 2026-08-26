import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RastreioService } from './rastreio.service';

const IDP_USER = { sub: 's1', email: 'a@a.com', name: 'A', role: null, system: 'x' };

function decimalFake(valor: number) {
  return { toNumber: () => valor, toString: () => String(valor) };
}

function vendedorEscopoServiceFake(
  escopo: Record<string, unknown> = { tipo: 'PROPRIO', vendedorId: 'v1' },
) {
  return { resolverEscopoVendedores: jest.fn().mockResolvedValue(escopo) };
}

function prismaFake(overrides: {
  vendedor?: Record<string, unknown> | null;
  pontos?: Record<string, unknown>[];
  vendedores?: Record<string, unknown>[];
  localizacoes?: Record<string, unknown>[];
} = {}) {
  const localizacoes = overrides.localizacoes ?? [];
  return {
    localizacaoUsuario: {
      createMany: jest.fn().mockResolvedValue(undefined),
      findMany: jest.fn().mockImplementation(
        async (args: {
          where: { usuarioId: string | { in: string[] } };
          distinct?: string[];
        }) => {
          if (args.distinct) {
            const usuarioIds = (args.where.usuarioId as { in: string[] }).in;
            // Mesma semantica do Prisma real: orderBy capturadoEm desc ja
            // aplicado nos dados de teste - so pega a primeira ocorrencia
            // de cada usuarioId (equivalente a distinct: ['usuarioId']).
            const vistos = new Set<string>();
            return localizacoes.filter((loc) => {
              const usuarioId = loc.usuarioId as string;
              if (!usuarioIds.includes(usuarioId) || vistos.has(usuarioId)) {
                return false;
              }
              vistos.add(usuarioId);
              return true;
            });
          }
          return overrides.pontos ?? [];
        },
      ),
    },
    vendedor: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          'vendedor' in overrides ? overrides.vendedor : { usuarioId: 'u1' },
        ),
      findMany: jest.fn().mockResolvedValue(overrides.vendedores ?? []),
    },
  };
}

describe('RastreioService.registrarLote', () => {
  it('grava todos os pontos com o timestamp original (capturadoEm), nao o momento do envio', async () => {
    const prisma = prismaFake();
    const service = new RastreioService(prisma as never, vendedorEscopoServiceFake() as never);

    const resultado = await service.registrarLote('u1', [
      { latitude: -23.5, longitude: -46.6, timestamp: '2026-01-01T10:00:00.000Z' },
      { latitude: -23.6, longitude: -46.7, timestamp: '2026-01-01T10:05:00.000Z' },
    ]);

    expect(resultado.quantidade).toBe(2);
    expect(prisma.localizacaoUsuario.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          usuarioId: 'u1',
          latitude: -23.5,
          longitude: -46.6,
          capturadoEm: new Date('2026-01-01T10:00:00.000Z'),
          loteId: resultado.loteId,
        }),
        expect.objectContaining({
          usuarioId: 'u1',
          latitude: -23.6,
          longitude: -46.7,
          capturadoEm: new Date('2026-01-01T10:05:00.000Z'),
          loteId: resultado.loteId,
        }),
      ],
    });
  });

  it('usa o mesmo loteId pra todos os pontos de uma chamada', async () => {
    const prisma = prismaFake();
    const service = new RastreioService(prisma as never, vendedorEscopoServiceFake() as never);

    await service.registrarLote('u1', [
      { latitude: 0, longitude: 0, timestamp: '2026-01-01T00:00:00.000Z' },
      { latitude: 1, longitude: 1, timestamp: '2026-01-01T00:01:00.000Z' },
    ]);

    const dados = prisma.localizacaoUsuario.createMany.mock.calls[0][0].data;
    expect(dados[0].loteId).toBe(dados[1].loteId);
  });
});

describe('RastreioService.consultarTrajeto', () => {
  it('lanca NotFoundException quando o vendedor nao existe', async () => {
    const prisma = prismaFake({ vendedor: null });
    const service = new RastreioService(prisma as never, vendedorEscopoServiceFake() as never);

    await expect(
      service.consultarTrajeto('inexistente', '2026-01-01'),
    ).rejects.toThrow(NotFoundException);
  });

  it('retorna trajeto vazio (sem erro) quando o vendedor nao tem usuario vinculado', async () => {
    const prisma = prismaFake({ vendedor: { usuarioId: null } });
    const service = new RastreioService(prisma as never, vendedorEscopoServiceFake() as never);

    const resultado = await service.consultarTrajeto('v1', '2026-01-01');

    expect(resultado.pontos).toEqual([]);
    expect(prisma.localizacaoUsuario.findMany).not.toHaveBeenCalled();
  });

  it('retorna os pontos do dia em ordem cronologica', async () => {
    const prisma = prismaFake({
      pontos: [
        {
          latitude: decimalFake(-23.5),
          longitude: decimalFake(-46.6),
          capturadoEm: new Date('2026-01-01T10:00:00.000Z'),
        },
        {
          latitude: decimalFake(-23.6),
          longitude: decimalFake(-46.7),
          capturadoEm: new Date('2026-01-01T11:00:00.000Z'),
        },
      ],
    });
    const service = new RastreioService(prisma as never, vendedorEscopoServiceFake() as never);

    const resultado = await service.consultarTrajeto('v1', '2026-01-01');

    expect(resultado.pontos).toEqual([
      { latitude: -23.5, longitude: -46.6, capturadoEm: '2026-01-01T10:00:00.000Z' },
      { latitude: -23.6, longitude: -46.7, capturadoEm: '2026-01-01T11:00:00.000Z' },
    ]);
  });

  it('filtra pelo dia inteiro (00:00 a 23:59:59.999) do parametro data', async () => {
    const prisma = prismaFake();
    const service = new RastreioService(prisma as never, vendedorEscopoServiceFake() as never);

    await service.consultarTrajeto('v1', '2026-01-01');

    expect(prisma.localizacaoUsuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuarioId: 'u1',
          capturadoEm: {
            gte: new Date('2026-01-01T00:00:00.000Z'),
            lte: new Date('2026-01-01T23:59:59.999Z'),
          },
        },
      }),
    );
  });
});

describe('RastreioService.obterUltimasPosicoesEquipe', () => {
  it('lanca ForbiddenException quando o escopo e PROPRIO (VENDEDOR comum, sem papel de supervisao)', async () => {
    const prisma = prismaFake();
    const service = new RastreioService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'PROPRIO', vendedorId: 'v1' }) as never,
    );

    await expect(
      service.obterUltimasPosicoesEquipe(IDP_USER as never, 'u1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lanca ForbiddenException quando o escopo e NENHUM', async () => {
    const prisma = prismaFake();
    const service = new RastreioService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'NENHUM' }) as never,
    );

    await expect(
      service.obterUltimasPosicoesEquipe(IDP_USER as never, 'u1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('escopo EQUIPE retorna so a ultima posicao de cada vendedor da equipe (criterio: supervisor ve a equipe correta)', async () => {
    const prisma = prismaFake({
      vendedores: [
        { id: 'v1', nome: 'Vendedor Um', usuarioId: 'u1' },
        { id: 'v2', nome: 'Vendedor Dois', usuarioId: 'u2' },
      ],
      localizacoes: [
        // ja em ordem desc por capturadoEm (mesma garantia do orderBy real)
        {
          usuarioId: 'u1',
          latitude: decimalFake(-23.5),
          longitude: decimalFake(-46.6),
          capturadoEm: new Date('2026-01-01T12:00:00.000Z'),
        },
        {
          usuarioId: 'u1',
          latitude: decimalFake(-23.4),
          longitude: decimalFake(-46.5),
          capturadoEm: new Date('2026-01-01T10:00:00.000Z'),
        },
        {
          usuarioId: 'u2',
          latitude: decimalFake(-22.0),
          longitude: decimalFake(-45.0),
          capturadoEm: new Date('2026-01-01T11:00:00.000Z'),
        },
      ],
    });
    const service = new RastreioService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'EQUIPE', vendedorIds: ['v1', 'v2'] }) as never,
    );

    const resultado = await service.obterUltimasPosicoesEquipe(IDP_USER as never, 'u-sup');

    expect(resultado).toEqual([
      {
        vendedorId: 'v1',
        vendedorNome: 'Vendedor Um',
        latitude: -23.5,
        longitude: -46.6,
        capturadoEm: '2026-01-01T12:00:00.000Z',
      },
      {
        vendedorId: 'v2',
        vendedorNome: 'Vendedor Dois',
        latitude: -22.0,
        longitude: -45.0,
        capturadoEm: '2026-01-01T11:00:00.000Z',
      },
    ]);
    expect(prisma.vendedor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['v1', 'v2'] } }),
      }),
    );
  });

  it('vendedor da equipe sem nenhuma localizacao registrada fica de fora da lista', async () => {
    const prisma = prismaFake({
      vendedores: [{ id: 'v1', nome: 'Vendedor Sem Posicao', usuarioId: 'u1' }],
      localizacoes: [],
    });
    const service = new RastreioService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'EQUIPE', vendedorIds: ['v1'] }) as never,
    );

    const resultado = await service.obterUltimasPosicoesEquipe(IDP_USER as never, 'u-sup');

    expect(resultado).toEqual([]);
  });

  it('escopo TODOS (admin) nao filtra por id de vendedor', async () => {
    const prisma = prismaFake({ vendedores: [], localizacoes: [] });
    const service = new RastreioService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'TODOS' }) as never,
    );

    await service.obterUltimasPosicoesEquipe(IDP_USER as never, 'u-admin');

    const chamada = prisma.vendedor.findMany.mock.calls[0][0];
    expect(chamada.where.id).toBeUndefined();
  });
});

describe('RastreioService.obterTrajetoEquipe', () => {
  it('lanca ForbiddenException quando o escopo e PROPRIO', async () => {
    const prisma = prismaFake();
    const service = new RastreioService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'PROPRIO', vendedorId: 'v1' }) as never,
    );

    await expect(
      service.obterTrajetoEquipe(IDP_USER as never, 'u1', 'v2', '2026-01-01'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lanca NotFoundException quando o vendedorId nao esta na equipe (anti-IDOR: 404, nao 403)', async () => {
    const prisma = prismaFake();
    const service = new RastreioService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'EQUIPE', vendedorIds: ['v1'] }) as never,
    );

    await expect(
      service.obterTrajetoEquipe(IDP_USER as never, 'u-sup', 'fora-da-equipe', '2026-01-01'),
    ).rejects.toThrow(NotFoundException);
  });

  it('retorna o trajeto quando o vendedorId esta na equipe', async () => {
    const prisma = prismaFake({
      vendedor: { usuarioId: 'u1' },
      pontos: [
        {
          latitude: decimalFake(-23.5),
          longitude: decimalFake(-46.6),
          capturadoEm: new Date('2026-01-01T10:00:00.000Z'),
        },
      ],
    });
    const service = new RastreioService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'EQUIPE', vendedorIds: ['v1'] }) as never,
    );

    const resultado = await service.obterTrajetoEquipe(IDP_USER as never, 'u-sup', 'v1', '2026-01-01');

    expect(resultado.pontos).toHaveLength(1);
  });

  it('escopo TODOS (admin) acessa qualquer vendedorId', async () => {
    const prisma = prismaFake({ vendedor: { usuarioId: 'u1' }, pontos: [] });
    const service = new RastreioService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'TODOS' }) as never,
    );

    await expect(
      service.obterTrajetoEquipe(IDP_USER as never, 'u-admin', 'qualquer-vendedor', '2026-01-01'),
    ).resolves.toBeDefined();
  });
});
