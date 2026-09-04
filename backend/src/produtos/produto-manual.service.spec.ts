import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProdutoManualService } from './produto-manual.service';

function produtoFake(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    idExternoErp: 'ext-1',
    nome: 'Cabo',
    imagemCaminho: null,
    imagemTipoMime: null,
    precoFabricacao: null,
    ...overrides,
  };
}

function prismaFake(produto: unknown) {
  return {
    produto: {
      findUnique: jest.fn().mockResolvedValue(produto),
      update: jest.fn().mockImplementation(({ data }) => ({ ...produtoFake(), ...data })),
    },
  };
}

function imagemStorageFake() {
  return {
    salvar: jest.fn().mockResolvedValue('/uploads/novo.jpg'),
    ler: jest.fn().mockResolvedValue(Buffer.from('conteudo')),
    remover: jest.fn().mockResolvedValue(undefined),
  };
}

describe('ProdutoManualService.atualizar', () => {
  it('lanca NotFoundException quando o produto nao existe', async () => {
    const service = new ProdutoManualService(
      prismaFake(null) as never,
      imagemStorageFake() as never,
    );

    await expect(
      service.atualizar('inexistente', { precoFabricacao: 10 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('atualiza precoFabricacao sem tocar em outros campos', async () => {
    const prisma = prismaFake(produtoFake());
    const service = new ProdutoManualService(prisma as never, imagemStorageFake() as never);

    await service.atualizar('p1', { precoFabricacao: 42 });

    expect(prisma.produto.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { precoFabricacao: 42 },
    });
  });
});

describe('ProdutoManualService.salvarImagem', () => {
  it('rejeita tipo MIME nao permitido antes de tocar no disco', async () => {
    const prisma = prismaFake(produtoFake());
    const imagemStorage = imagemStorageFake();
    const service = new ProdutoManualService(prisma as never, imagemStorage as never);

    await expect(
      service.salvarImagem('p1', {
        mimetype: 'application/pdf',
        buffer: Buffer.from(''),
        originalname: 'x.pdf',
      } as Express.Multer.File),
    ).rejects.toThrow(BadRequestException);
    expect(imagemStorage.salvar).not.toHaveBeenCalled();
  });

  it('remove a imagem antiga do disco so DEPOIS do update confirmado', async () => {
    const prisma = prismaFake(produtoFake({ imagemCaminho: '/uploads/antigo.jpg' }));
    const imagemStorage = imagemStorageFake();
    const service = new ProdutoManualService(prisma as never, imagemStorage as never);

    await service.salvarImagem('p1', {
      mimetype: 'image/png',
      buffer: Buffer.from('nova'),
      originalname: 'nova.png',
    } as Express.Multer.File);

    expect(imagemStorage.remover).toHaveBeenCalledWith('/uploads/antigo.jpg');
    expect(prisma.produto.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { imagemCaminho: '/uploads/novo.jpg', imagemTipoMime: 'image/png' },
    });
  });
});

describe('ProdutoManualService.obterImagem', () => {
  it('lanca NotFoundException quando o produto nao tem imagem cadastrada', async () => {
    const prisma = prismaFake(produtoFake());
    const service = new ProdutoManualService(prisma as never, imagemStorageFake() as never);

    await expect(service.obterImagem('p1')).rejects.toThrow(NotFoundException);
  });

  it('retorna buffer e tipoMime quando a imagem existe', async () => {
    const prisma = prismaFake(
      produtoFake({ imagemCaminho: '/uploads/foto.jpg', imagemTipoMime: 'image/jpeg' }),
    );
    const imagemStorage = imagemStorageFake();
    const service = new ProdutoManualService(prisma as never, imagemStorage as never);

    const resultado = await service.obterImagem('p1');

    expect(imagemStorage.ler).toHaveBeenCalledWith('/uploads/foto.jpg');
    expect(resultado.tipoMime).toBe('image/jpeg');
  });
});
