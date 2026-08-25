import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClienteLocalizacaoService } from './cliente-localizacao.service';

function decimalFake(valor: number) {
  return { toNumber: () => valor, toString: () => String(valor) };
}

function prismaFake(overrides: {
  vendedor?: Record<string, unknown> | null;
  cliente?: Record<string, unknown> | null;
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
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'cliente-1',
        localizacaoLat: decimalFake(data.localizacaoLat as number),
        localizacaoLng: decimalFake(data.localizacaoLng as number),
        localizacaoDefinidaEm: data.localizacaoDefinidaEm,
      })),
    },
  };
}

describe('ClienteLocalizacaoService.definir', () => {
  it('lanca ForbiddenException quando o usuario nao e um vendedor cadastrado', async () => {
    const prisma = prismaFake({ vendedor: null });
    const service = new ClienteLocalizacaoService(prisma as never);

    await expect(
      service.definir('u1', 'cliente-1', { latitude: -23.5505, longitude: -46.6333 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lanca NotFoundException quando o cliente nao pertence ao vendedor', async () => {
    const prisma = prismaFake({ cliente: null });
    const service = new ClienteLocalizacaoService(prisma as never);

    await expect(
      service.definir('u1', 'cliente-1', { latitude: -23.5505, longitude: -46.6333 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('grava latitude/longitude/definidaEm/definidaPorId quando o vendedor e vinculado ao cliente', async () => {
    const prisma = prismaFake();
    const service = new ClienteLocalizacaoService(prisma as never);

    const resultado = await service.definir('u1', 'cliente-1', {
      latitude: -23.5505,
      longitude: -46.6333,
    });

    expect(prisma.cliente.findFirst).toHaveBeenCalledWith({
      where: { id: 'cliente-1', vendedores: { some: { vendedorId: 'vendedor-1' } } },
    });
    expect(prisma.cliente.update).toHaveBeenCalledWith({
      where: { id: 'cliente-1' },
      data: expect.objectContaining({
        localizacaoLat: -23.5505,
        localizacaoLng: -46.6333,
        localizacaoDefinidaPorId: 'vendedor-1',
      }),
    });
    expect(resultado).toEqual({
      clienteId: 'cliente-1',
      latitude: -23.5505,
      longitude: -46.6333,
      definidaEm: expect.any(String),
    });
  });
});
