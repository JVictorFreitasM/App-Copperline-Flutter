import { NotFoundException } from '@nestjs/common';
import { FavoritosService } from './favoritos.service';

function prismaFake(overrides: { produto?: unknown; favoritos?: unknown[] } = {}) {
  return {
    produto: { findUnique: jest.fn().mockResolvedValue(overrides.produto ?? null) },
    produtoFavorito: {
      upsert: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn().mockResolvedValue(undefined),
      findMany: jest.fn().mockResolvedValue(overrides.favoritos ?? []),
    },
  };
}

describe('FavoritosService', () => {
  it('favoritar() lanca NotFoundException se o produto nao existir', async () => {
    const prisma = prismaFake({ produto: null });
    const service = new FavoritosService(prisma as never);

    await expect(service.favoritar('usuario-1', 'produto-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.produtoFavorito.upsert).not.toHaveBeenCalled();
  });

  it('favoritar() faz upsert quando o produto existe', async () => {
    const prisma = prismaFake({ produto: { id: 'produto-1' } });
    const service = new FavoritosService(prisma as never);

    await service.favoritar('usuario-1', 'produto-1');

    expect(prisma.produtoFavorito.upsert).toHaveBeenCalledWith({
      where: { usuarioId_produtoId: { usuarioId: 'usuario-1', produtoId: 'produto-1' } },
      create: { usuarioId: 'usuario-1', produtoId: 'produto-1' },
      update: {},
    });
  });

  it('desfavoritar() remove sem exigir que exista antes', async () => {
    const prisma = prismaFake();
    const service = new FavoritosService(prisma as never);

    await service.desfavoritar('usuario-1', 'produto-1');

    expect(prisma.produtoFavorito.deleteMany).toHaveBeenCalledWith({
      where: { usuarioId: 'usuario-1', produtoId: 'produto-1' },
    });
  });
});
