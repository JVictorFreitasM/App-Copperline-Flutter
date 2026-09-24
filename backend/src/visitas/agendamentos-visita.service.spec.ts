import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';
import { AgendamentosVisitaService } from './agendamentos-visita.service';

const IDP_USER = { sub: 'u1', role: 'user' } as IdpUser;

function vendedorEscopoServiceFake(escopo: EscopoClientes) {
  return { resolverEscopoVendedores: jest.fn().mockResolvedValue(escopo) };
}

function agendamentoBruto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agendamento-1',
    clienteId: 'cliente-1',
    vendedorId: 'vendedor-1',
    dataHoraPrevista: new Date('2026-09-15T10:00:00.000Z'),
    criadoEm: new Date('2026-09-14T00:00:00.000Z'),
    ...overrides,
  };
}

function prismaFake(overrides: {
  vendedor?: Record<string, unknown> | null;
  cliente?: Record<string, unknown> | null;
  agendamentos?: Record<string, unknown>[];
} = {}) {
  return {
    vendedor: {
      findFirst: jest
        .fn()
        .mockResolvedValue('vendedor' in overrides ? overrides.vendedor : { id: 'vendedor-1' }),
    },
    cliente: {
      findFirst: jest
        .fn()
        .mockResolvedValue('cliente' in overrides ? overrides.cliente : { id: 'cliente-1' }),
    },
    agendamentoVisita: {
      create: jest.fn().mockImplementation(async ({ data }) => agendamentoBruto(data)),
      findMany: jest.fn().mockResolvedValue(overrides.agendamentos ?? []),
    },
  };
}

describe('AgendamentosVisitaService.criar', () => {
  it('lanca ForbiddenException quando o usuario nao e um vendedor cadastrado', async () => {
    const prisma = prismaFake({ vendedor: null });
    const service = new AgendamentosVisitaService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'NENHUM' }) as never,
    );

    await expect(
      service.criar('u1', { clienteId: 'cliente-1', dataHoraPrevista: new Date() }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lanca NotFoundException quando o cliente nao existe ou nao e atendido pelo vendedor (anti-IDOR)', async () => {
    const prisma = prismaFake({ cliente: null });
    const service = new AgendamentosVisitaService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'NENHUM' }) as never,
    );

    await expect(
      service.criar('u1', { clienteId: 'cliente-de-outro', dataHoraPrevista: new Date() }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.agendamentoVisita.create).not.toHaveBeenCalled();
  });

  it('cria o agendamento vinculado ao vendedor resolvido e a quem criou', async () => {
    const prisma = prismaFake();
    const service = new AgendamentosVisitaService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'NENHUM' }) as never,
    );
    const dataHoraPrevista = new Date('2026-09-15T10:00:00.000Z');

    await service.criar('u1', { clienteId: 'cliente-1', dataHoraPrevista });

    expect(prisma.agendamentoVisita.create).toHaveBeenCalledWith({
      data: {
        clienteId: 'cliente-1',
        vendedorId: 'vendedor-1',
        dataHoraPrevista,
        criadoPorId: 'u1',
      },
    });
  });
});

describe('AgendamentosVisitaService.listarPorVendedor', () => {
  it('lista so os agendamentos do PROPRIO vendedor (escopo individual)', async () => {
    const prisma = prismaFake({ agendamentos: [agendamentoBruto()] });
    const service = new AgendamentosVisitaService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'NENHUM' }) as never,
    );

    await service.listarPorVendedor('u1');

    expect(prisma.agendamentoVisita.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vendedorId: 'vendedor-1' } }),
    );
  });

  it('filtra por clienteId quando informado', async () => {
    const prisma = prismaFake();
    const service = new AgendamentosVisitaService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'NENHUM' }) as never,
    );

    await service.listarPorVendedor('u1', 'cliente-1');

    expect(prisma.agendamentoVisita.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vendedorId: 'vendedor-1', clienteId: 'cliente-1' } }),
    );
  });
});

describe('AgendamentosVisitaService.listarEquipe', () => {
  function prismaFakeEquipe(agendamentosEquipe: Record<string, unknown>[] = []) {
    return {
      vendedor: { findFirst: jest.fn() },
      cliente: { findFirst: jest.fn() },
      agendamentoVisita: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue(agendamentosEquipe),
      },
    };
  }

  it('lanca ForbiddenException quando o usuario nao tem papel de supervisao (escopo PROPRIO)', async () => {
    const prisma = prismaFakeEquipe();
    const service = new AgendamentosVisitaService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'PROPRIO', vendedorId: 'vendedor-1' }) as never,
    );

    await expect(service.listarEquipe(IDP_USER, 'u1', {})).rejects.toThrow(ForbiddenException);
  });

  it('lanca ForbiddenException quando o escopo e NENHUM', async () => {
    const prisma = prismaFakeEquipe();
    const service = new AgendamentosVisitaService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'NENHUM' }) as never,
    );

    await expect(service.listarEquipe(IDP_USER, 'u1', {})).rejects.toThrow(ForbiddenException);
  });

  it('lanca NotFoundException quando vendedorId do filtro esta fora da equipe (anti-IDOR)', async () => {
    const prisma = prismaFakeEquipe();
    const service = new AgendamentosVisitaService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'EQUIPE', vendedorIds: ['v1', 'v2'] }) as never,
    );

    await expect(
      service.listarEquipe(IDP_USER, 'u1', { vendedorId: 'fora-da-equipe' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('lista os agendamentos de toda a equipe quando nenhum vendedorId e informado', async () => {
    const prisma = prismaFakeEquipe([
      { ...agendamentoBruto(), vendedor: { id: 'v1', nome: 'V1' }, cliente: { id: 'cliente-1', razaoSocial: 'Cliente 1' } },
    ]);
    const service = new AgendamentosVisitaService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'EQUIPE', vendedorIds: ['v1', 'v2'] }) as never,
    );

    const resultado = await service.listarEquipe(IDP_USER, 'u1', {});

    expect(prisma.agendamentoVisita.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vendedorId: { in: ['v1', 'v2'] } } }),
    );
    expect(resultado[0].vendedor).toEqual({ id: 'v1', nome: 'V1' });
  });

  it('admin (escopo TODOS) lista sem filtro de vendedor', async () => {
    const prisma = prismaFakeEquipe();
    const service = new AgendamentosVisitaService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'TODOS' }) as never,
    );

    await service.listarEquipe(IDP_USER, 'u1', {});

    expect(prisma.agendamentoVisita.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});
