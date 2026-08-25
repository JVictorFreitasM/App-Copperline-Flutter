import { NotFoundException } from '@nestjs/common';
import { RastreioService } from './rastreio.service';

function decimalFake(valor: number) {
  return { toNumber: () => valor, toString: () => String(valor) };
}

function prismaFake(overrides: {
  vendedor?: Record<string, unknown> | null;
  pontos?: Record<string, unknown>[];
} = {}) {
  return {
    localizacaoUsuario: {
      createMany: jest.fn().mockResolvedValue(undefined),
      findMany: jest.fn().mockResolvedValue(overrides.pontos ?? []),
    },
    vendedor: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          'vendedor' in overrides ? overrides.vendedor : { usuarioId: 'u1' },
        ),
    },
  };
}

describe('RastreioService.registrarLote', () => {
  it('grava todos os pontos com o timestamp original (capturadoEm), nao o momento do envio', async () => {
    const prisma = prismaFake();
    const service = new RastreioService(prisma as never);

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
    const service = new RastreioService(prisma as never);

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
    const service = new RastreioService(prisma as never);

    await expect(
      service.consultarTrajeto('inexistente', '2026-01-01'),
    ).rejects.toThrow(NotFoundException);
  });

  it('retorna trajeto vazio (sem erro) quando o vendedor nao tem usuario vinculado', async () => {
    const prisma = prismaFake({ vendedor: { usuarioId: null } });
    const service = new RastreioService(prisma as never);

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
    const service = new RastreioService(prisma as never);

    const resultado = await service.consultarTrajeto('v1', '2026-01-01');

    expect(resultado.pontos).toEqual([
      { latitude: -23.5, longitude: -46.6, capturadoEm: '2026-01-01T10:00:00.000Z' },
      { latitude: -23.6, longitude: -46.7, capturadoEm: '2026-01-01T11:00:00.000Z' },
    ]);
  });

  it('filtra pelo dia inteiro (00:00 a 23:59:59.999) do parametro data', async () => {
    const prisma = prismaFake();
    const service = new RastreioService(prisma as never);

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
