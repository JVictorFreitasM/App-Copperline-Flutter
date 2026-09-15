import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ProdutoManualService } from './produto-manual.service';

function produtoFake(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    idExternoErp: 'ext-1',
    nome: 'Cabo',
    imagemCaminho: null,
    imagemTipoMime: null,
    precoFabricacao: null,
    tipoAcondicionamentoId: null,
    ...overrides,
  };
}

function prismaFake(
  produto: unknown,
  overrides: { tipoAcondicionamento?: Record<string, unknown> | null } = {},
) {
  return {
    produto: {
      findUnique: jest.fn().mockResolvedValue(produto),
      update: jest.fn().mockImplementation(({ data }) => ({ ...produtoFake(), ...data })),
    },
    tipoAcondicionamento: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          'tipoAcondicionamento' in overrides
            ? overrides.tipoAcondicionamento
            : { id: 'tipo-1', nome: 'Caixa', ativo: true },
        ),
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

  it('atualiza tipoAcondicionamentoId quando o tipo existe e esta ativo', async () => {
    const prisma = prismaFake(produtoFake());
    const service = new ProdutoManualService(prisma as never, imagemStorageFake() as never);

    await service.atualizar('p1', { tipoAcondicionamentoId: 'tipo-1' });

    expect(prisma.tipoAcondicionamento.findUnique).toHaveBeenCalledWith({
      where: { id: 'tipo-1' },
    });
    expect(prisma.produto.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { tipoAcondicionamentoId: 'tipo-1' },
    });
  });

  it('limpa a associacao quando tipoAcondicionamentoId e null explicito, sem validar contra o catalogo', async () => {
    const prisma = prismaFake(produtoFake({ tipoAcondicionamentoId: 'tipo-1' }));
    const service = new ProdutoManualService(prisma as never, imagemStorageFake() as never);

    await service.atualizar('p1', { tipoAcondicionamentoId: null });

    expect(prisma.tipoAcondicionamento.findUnique).not.toHaveBeenCalled();
    expect(prisma.produto.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { tipoAcondicionamentoId: null },
    });
  });

  it('lanca UnprocessableEntityException quando tipoAcondicionamentoId nao existe', async () => {
    const prisma = prismaFake(produtoFake(), { tipoAcondicionamento: null });
    const service = new ProdutoManualService(prisma as never, imagemStorageFake() as never);

    await expect(
      service.atualizar('p1', { tipoAcondicionamentoId: 'inexistente' }),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(prisma.produto.update).not.toHaveBeenCalled();
  });

  it('lanca UnprocessableEntityException quando tipoAcondicionamentoId esta inativo', async () => {
    const prisma = prismaFake(produtoFake(), {
      tipoAcondicionamento: { id: 'tipo-1', nome: 'Caixa', ativo: false },
    });
    const service = new ProdutoManualService(prisma as never, imagemStorageFake() as never);

    await expect(
      service.atualizar('p1', { tipoAcondicionamentoId: 'tipo-1' }),
    ).rejects.toThrow(UnprocessableEntityException);
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
