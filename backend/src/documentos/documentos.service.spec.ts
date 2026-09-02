import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentosService } from './documentos.service';

function prismaFake(overrides: {
  findMany?: unknown[];
  count?: number;
  findUnique?: unknown;
  create?: unknown;
}) {
  return {
    documento: {
      findMany: jest.fn().mockResolvedValue(overrides.findMany ?? []),
      count: jest.fn().mockResolvedValue(overrides.count ?? 0),
      findUnique: jest.fn().mockResolvedValue(overrides.findUnique ?? null),
      create: jest.fn().mockResolvedValue(overrides.create ?? null),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

function storageFake(overrides: { salvar?: string; ler?: Buffer } = {}) {
  return {
    salvar: jest.fn().mockResolvedValue(overrides.salvar ?? '/uploads/documentos/x.pdf'),
    ler: jest.fn().mockResolvedValue(overrides.ler ?? Buffer.from('conteudo')),
    remover: jest.fn().mockResolvedValue(undefined),
  };
}

const DOCUMENTO_BRUTO = {
  id: 'doc-1',
  nome: 'Tabela de preços',
  categoria: 'Comercial',
  caminhoArquivo: '/uploads/documentos/x.pdf',
  tipoMime: 'application/pdf',
  tamanhoBytes: 1024,
  enviadoPorId: 'usuario-1',
  criadoEm: new Date('2026-08-01'),
  enviadoPor: { id: 'usuario-1', nome: 'Vendedora Teste' },
};

describe('DocumentosService.listar', () => {
  it('mapeia enviadoPor pro nome do usuario (nao id/email)', async () => {
    const prisma = prismaFake({ findMany: [DOCUMENTO_BRUTO], count: 1 });
    const service = new DocumentosService(prisma as never, storageFake() as never);

    const resultado = await service.listar({ page: 1, limit: 20 });

    expect(resultado.data[0].enviadoPor).toBe('Vendedora Teste');
    expect(resultado.data[0]).not.toHaveProperty('caminhoArquivo');
  });

  it('filtra por categoria quando informado', async () => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new DocumentosService(prisma as never, storageFake() as never);

    await service.listar({ page: 1, limit: 20, categoria: 'Comercial' });

    expect(prisma.documento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { categoria: 'Comercial' } }),
    );
  });
});

describe('DocumentosService.criar', () => {
  it('rejeita tipo de arquivo fora da whitelist antes de salvar no disco', async () => {
    const prisma = prismaFake({});
    const storage = storageFake();
    const service = new DocumentosService(prisma as never, storage as never);
    const arquivoExecutavel = {
      mimetype: 'application/x-msdownload',
      originalname: 'virus.exe',
      buffer: Buffer.from(''),
      size: 10,
    } as Express.Multer.File;

    await expect(
      service.criar('usuario-1', { nome: 'x', categoria: 'y' }, arquivoExecutavel),
    ).rejects.toThrow(BadRequestException);
    expect(storage.salvar).not.toHaveBeenCalled();
    expect(prisma.documento.create).not.toHaveBeenCalled();
  });

  it('aceita PDF e persiste com o enviadoPorId do usuario autenticado', async () => {
    const prisma = prismaFake({ create: DOCUMENTO_BRUTO });
    const storage = storageFake({ salvar: '/uploads/documentos/x.pdf' });
    const service = new DocumentosService(prisma as never, storage as never);
    const arquivoPdf = {
      mimetype: 'application/pdf',
      originalname: 'tabela.pdf',
      buffer: Buffer.from('conteudo'),
      size: 1024,
    } as Express.Multer.File;

    await service.criar('usuario-1', { nome: 'Tabela de preços', categoria: 'Comercial' }, arquivoPdf);

    expect(prisma.documento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enviadoPorId: 'usuario-1',
          caminhoArquivo: '/uploads/documentos/x.pdf',
          tipoMime: 'application/pdf',
        }),
      }),
    );
  });
});

describe('DocumentosService.obterParaDownload', () => {
  it('lança NotFoundException quando o documento nao existe', async () => {
    const prisma = prismaFake({ findUnique: null });
    const service = new DocumentosService(prisma as never, storageFake() as never);

    await expect(service.obterParaDownload('inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('le o arquivo do storage no caminho gravado no documento', async () => {
    const prisma = prismaFake({ findUnique: DOCUMENTO_BRUTO });
    const storage = storageFake({ ler: Buffer.from('bytes-do-arquivo') });
    const service = new DocumentosService(prisma as never, storage as never);

    const resultado = await service.obterParaDownload('doc-1');

    expect(storage.ler).toHaveBeenCalledWith('/uploads/documentos/x.pdf');
    expect(resultado.nome).toBe('Tabela de preços');
    expect(resultado.tipoMime).toBe('application/pdf');
  });
});

describe('DocumentosService.remover', () => {
  it('lança NotFoundException quando o documento nao existe', async () => {
    const prisma = prismaFake({ findUnique: null });
    const service = new DocumentosService(prisma as never, storageFake() as never);

    await expect(service.remover('inexistente')).rejects.toThrow(NotFoundException);
  });

  it('remove o registro e o arquivo do disco no caminho gravado', async () => {
    const prisma = prismaFake({ findUnique: DOCUMENTO_BRUTO });
    const storage = storageFake();
    const service = new DocumentosService(prisma as never, storage as never);

    await service.remover('doc-1');

    expect(prisma.documento.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
    expect(storage.remover).toHaveBeenCalledWith('/uploads/documentos/x.pdf');
  });
});
