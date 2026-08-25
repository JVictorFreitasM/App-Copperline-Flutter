import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { VisitasService } from './visitas.service';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';

const ESCOPO_TODOS: EscopoClientes = { tipo: 'TODOS' };

function decimalFake(valor: number) {
  return { toNumber: () => valor, toString: () => String(valor) };
}

function visitaBruta(overrides: Record<string, unknown> = {}) {
  return {
    id: 'visita-1',
    clienteId: 'cliente-1',
    vendedorId: 'vendedor-1',
    checkinEm: new Date('2026-01-01T10:00:00.000Z'),
    checkinLat: decimalFake(-23.5),
    checkinLng: decimalFake(-46.6),
    checkoutEm: null,
    checkoutLat: null,
    checkoutLng: null,
    nota: null,
    ...overrides,
  };
}

function prismaFake(overrides: {
  vendedor?: Record<string, unknown> | null;
  cliente?: Record<string, unknown> | null;
  visitaAberta?: Record<string, unknown> | null;
  visitaExistente?: Record<string, unknown> | null;
  visitasDoCliente?: Record<string, unknown>[];
} = {}) {
  return {
    vendedor: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          'vendedor' in overrides ? overrides.vendedor : { id: 'vendedor-1' },
        ),
    },
    cliente: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          'cliente' in overrides ? overrides.cliente : { id: 'cliente-1' },
        ),
    },
    visita: {
      findFirst: jest
        .fn()
        .mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
          'checkoutEm' in where
            ? ('visitaAberta' in overrides ? overrides.visitaAberta : null)
            : ('visitaExistente' in overrides ? overrides.visitaExistente : visitaBruta()),
        ),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        visitaBruta({ ...data, checkinLat: decimalFake(data.checkinLat as number), checkinLng: decimalFake(data.checkinLng as number) }),
      ),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        visitaBruta({
          checkoutEm: data.checkoutEm,
          checkoutLat: decimalFake(data.checkoutLat as number),
          checkoutLng: decimalFake(data.checkoutLng as number),
          ...(data.nota !== undefined && { nota: data.nota }),
        }),
      ),
      findMany: jest.fn().mockResolvedValue(overrides.visitasDoCliente ?? [visitaBruta()]),
    },
  };
}

describe('VisitasService.checkin', () => {
  it('lanca ForbiddenException quando o usuario nao e um vendedor cadastrado', async () => {
    const prisma = prismaFake({ vendedor: null });
    const service = new VisitasService(prisma as never);

    await expect(
      service.checkin('u1', { clienteId: 'c1', latitude: 0, longitude: 0 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lanca NotFoundException quando o cliente nao pertence ao vendedor', async () => {
    const prisma = prismaFake({ cliente: null });
    const service = new VisitasService(prisma as never);

    await expect(
      service.checkin('u1', { clienteId: 'c1', latitude: 0, longitude: 0 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('bloqueia com ConflictException quando ja existe visita aberta do vendedor (criterio de aceite)', async () => {
    const prisma = prismaFake({
      visitaAberta: { id: 'visita-aberta', clienteId: 'outro-cliente' },
    });
    const service = new VisitasService(prisma as never);

    await expect(
      service.checkin('u1', { clienteId: 'c1', latitude: 0, longitude: 0 }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.visita.create).not.toHaveBeenCalled();
  });

  it('cria a visita com checkinEm/checkinLat/checkinLng quando nao ha visita aberta', async () => {
    const prisma = prismaFake();
    const service = new VisitasService(prisma as never);

    const resultado = await service.checkin('u1', {
      clienteId: 'cliente-1',
      latitude: -23.5,
      longitude: -46.6,
      nota: 'Cliente pediu desconto',
    });

    expect(prisma.visita.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clienteId: 'cliente-1',
        vendedorId: 'vendedor-1',
        checkinLat: -23.5,
        checkinLng: -46.6,
        nota: 'Cliente pediu desconto',
      }),
    });
    expect(resultado.checkoutEm).toBeNull();
  });
});

describe('VisitasService.checkout', () => {
  it('lanca NotFoundException quando a visita nao existe ou nao pertence ao vendedor', async () => {
    const prisma = prismaFake({ visitaExistente: null });
    const service = new VisitasService(prisma as never);

    await expect(
      service.checkout('u1', 'visita-1', { latitude: 0, longitude: 0 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanca ConflictException quando a visita ja teve checkout', async () => {
    const prisma = prismaFake({
      visitaExistente: visitaBruta({ checkoutEm: new Date('2026-01-01T11:00:00.000Z') }),
    });
    const service = new VisitasService(prisma as never);

    await expect(
      service.checkout('u1', 'visita-1', { latitude: 0, longitude: 0 }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.visita.update).not.toHaveBeenCalled();
  });

  it('atualiza checkoutEm/checkoutLat/checkoutLng quando a visita esta aberta', async () => {
    const prisma = prismaFake();
    const service = new VisitasService(prisma as never);

    const resultado = await service.checkout('u1', 'visita-1', {
      latitude: -23.6,
      longitude: -46.7,
    });

    expect(prisma.visita.update).toHaveBeenCalledWith({
      where: { id: 'visita-1' },
      data: expect.objectContaining({
        checkoutLat: -23.6,
        checkoutLng: -46.7,
      }),
    });
    expect(resultado.checkoutEm).not.toBeNull();
  });

  it('preserva a nota do checkin quando nenhuma nova nota e enviada no checkout', async () => {
    const prisma = prismaFake();
    const service = new VisitasService(prisma as never);

    await service.checkout('u1', 'visita-1', { latitude: 0, longitude: 0 });

    const dadosEnviados = prisma.visita.update.mock.calls[0][0].data;
    expect('nota' in dadosEnviados).toBe(false);
  });

  it('sobrescreve a nota quando uma nova vem no checkout', async () => {
    const prisma = prismaFake();
    const service = new VisitasService(prisma as never);

    await service.checkout('u1', 'visita-1', {
      latitude: 0,
      longitude: 0,
      nota: 'Fechou pedido de 500 metros',
    });

    expect(prisma.visita.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nota: 'Fechou pedido de 500 metros' }),
      }),
    );
  });
});

describe('VisitasService.listarPorCliente', () => {
  it('lanca NotFoundException quando o cliente nao existe ou esta fora do escopo', async () => {
    const prisma = prismaFake({ cliente: null });
    const service = new VisitasService(prisma as never);

    await expect(service.listarPorCliente('c1', ESCOPO_TODOS)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lanca NotFoundException sem consultar o banco quando o escopo e NENHUM', async () => {
    const prisma = prismaFake();
    const service = new VisitasService(prisma as never);

    await expect(
      service.listarPorCliente('c1', { tipo: 'NENHUM' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
  });

  it('retorna o historico do cliente em ordem cronologica decrescente', async () => {
    const prisma = prismaFake({
      visitasDoCliente: [
        visitaBruta({ id: 'v2', checkinEm: new Date('2026-01-02T00:00:00.000Z') }),
        visitaBruta({ id: 'v1', checkinEm: new Date('2026-01-01T00:00:00.000Z') }),
      ],
    });
    const service = new VisitasService(prisma as never);

    const resultado = await service.listarPorCliente('cliente-1', ESCOPO_TODOS);

    expect(prisma.visita.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { checkinEm: 'desc' } }),
    );
    expect(resultado.map((v) => v.id)).toEqual(['v2', 'v1']);
  });
});
