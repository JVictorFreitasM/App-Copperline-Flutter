import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AgendamentosVisitaService } from './agendamentos-visita.service';

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
    const service = new AgendamentosVisitaService(prisma as never);

    await expect(
      service.criar('u1', { clienteId: 'cliente-1', dataHoraPrevista: new Date() }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lanca NotFoundException quando o cliente nao existe ou nao e atendido pelo vendedor (anti-IDOR)', async () => {
    const prisma = prismaFake({ cliente: null });
    const service = new AgendamentosVisitaService(prisma as never);

    await expect(
      service.criar('u1', { clienteId: 'cliente-de-outro', dataHoraPrevista: new Date() }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.agendamentoVisita.create).not.toHaveBeenCalled();
  });

  it('cria o agendamento vinculado ao vendedor resolvido e a quem criou', async () => {
    const prisma = prismaFake();
    const service = new AgendamentosVisitaService(prisma as never);
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
    const service = new AgendamentosVisitaService(prisma as never);

    await service.listarPorVendedor('u1');

    expect(prisma.agendamentoVisita.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vendedorId: 'vendedor-1' } }),
    );
  });

  it('filtra por clienteId quando informado', async () => {
    const prisma = prismaFake();
    const service = new AgendamentosVisitaService(prisma as never);

    await service.listarPorVendedor('u1', 'cliente-1');

    expect(prisma.agendamentoVisita.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vendedorId: 'vendedor-1', clienteId: 'cliente-1' } }),
    );
  });
});
