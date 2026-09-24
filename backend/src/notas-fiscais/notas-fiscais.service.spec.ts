import { NotFoundException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { NotasFiscaisService } from './notas-fiscais.service';

jest.mock('node:fs/promises');
const readFileMock = readFile as jest.MockedFunction<typeof readFile>;

function prismaFake(overrides: {
  findMany?: unknown[];
  count?: number;
  findUnique?: unknown;
}) {
  return {
    notaFiscal: {
      findMany: jest.fn().mockResolvedValue(overrides.findMany ?? []),
      count: jest.fn().mockResolvedValue(overrides.count ?? 0),
      findUnique: jest.fn().mockResolvedValue(overrides.findUnique ?? null),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

function configServiceFake(diretorio = '/mnt/notas') {
  return { getOrThrow: jest.fn().mockReturnValue(diretorio) };
}

const NOTA_BRUTA = {
  id: '1',
  idExternoErp: 'ext-1',
  chave: '12345',
  tipo: 'SAIDA',
  numero: 100,
  serie: '1',
  dataEmissao: new Date('2026-08-01'),
  statusNfe: 'AUTORIZADA',
  nfseGerada: false,
  nfseCancelada: false,
  valorTotalNotaFiscal: { toString: () => '1500.00' },
  sincronizadoEm: new Date('2026-08-01'),
  pedidos: [
    {
      pedido: {
        id: 'pedido-1',
        numero: 'PED-1',
        cliente: { id: 'cli-1', razaoSocial: 'Cliente A' },
      },
    },
  ],
};

describe('NotasFiscaisService.listar', () => {
  it('inclui o aviso da janela de 60 dias na resposta', async () => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new NotasFiscaisService(prisma as never, configServiceFake() as never);

    const resultado = await service.listar({ page: 1, limit: 20 });

    expect(resultado.aviso).toMatch(/60 dias/);
  });

  it('resolve pedidos vinculados com numero e cliente (nao so o id)', async () => {
    const prisma = prismaFake({ findMany: [NOTA_BRUTA], count: 1 });
    const service = new NotasFiscaisService(prisma as never, configServiceFake() as never);

    const resultado = await service.listar({ page: 1, limit: 20 });

    expect(resultado.data[0].pedidos).toEqual([
      {
        id: 'pedido-1',
        numero: 'PED-1',
        cliente: { id: 'cli-1', razaoSocial: 'Cliente A' },
      },
    ]);
    expect(resultado.data[0].valorTotalNotaFiscal).toBe('1500.00');
  });

  it('filtra por clienteNome via pedidos vinculados quando informado', async () => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new NotasFiscaisService(prisma as never, configServiceFake() as never);

    await service.listar({ page: 1, limit: 20, clienteNome: 'Acme' });

    expect(prisma.notaFiscal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          pedidos: {
            some: {
              pedido: {
                cliente: {
                  OR: [
                    { razaoSocial: { contains: 'Acme', mode: 'insensitive' } },
                    {
                      nomeFantasia: { contains: 'Acme', mode: 'insensitive' },
                    },
                  ],
                },
              },
            },
          },
        },
      }),
    );
  });
});

describe('NotasFiscaisService.buscarPorId', () => {
  it('lança NotFoundException quando a nota fiscal nao existe', async () => {
    const prisma = prismaFake({ findUnique: null });
    const service = new NotasFiscaisService(prisma as never, configServiceFake() as never);

    await expect(service.buscarPorId('inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('NotasFiscaisService.obterPdf', () => {
  afterEach(() => {
    readFileMock.mockReset();
  });

  it('lança NotFoundException quando a nota fiscal nao existe', async () => {
    const prisma = prismaFake({ findUnique: null });
    const service = new NotasFiscaisService(prisma as never, configServiceFake() as never);

    await expect(service.obterPdf('inexistente')).rejects.toThrow(NotFoundException);
  });

  it('lança NotFoundException quando a nota nao tem chave (NFS-e, fora de escopo) - nunca tenta ler arquivo', async () => {
    const prisma = prismaFake({
      findUnique: { chave: null, dataEmissao: new Date('2025-09-22'), numero: 100 },
    });
    const service = new NotasFiscaisService(prisma as never, configServiceFake() as never);

    await expect(service.obterPdf('nota-1')).rejects.toThrow(/chave de acesso/);
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it('resolve o caminho pela pasta compartilhada e le o arquivo quando a chave existe', async () => {
    const prisma = prismaFake({
      findUnique: {
        chave: 'chave-44-digitos',
        dataEmissao: new Date('2025-09-22T09:00:00.000Z'),
        numero: 159843,
      },
    });
    const service = new NotasFiscaisService(
      prisma as never,
      configServiceFake('/mnt/notas') as never,
    );
    readFileMock.mockResolvedValue(Buffer.from('conteudo-pdf'));

    const resultado = await service.obterPdf('nota-1');

    expect(readFileMock).toHaveBeenCalledWith(
      '/mnt/notas/2025/09/22/chave-44-digitos-nfe.pdf',
    );
    expect(resultado.buffer.toString()).toBe('conteudo-pdf');
    expect(resultado.nomeArquivo).toBe('159843-nfe.pdf');
  });

  it('lança NotFoundException com mensagem clara quando o arquivo nao existe na pasta (ENOENT)', async () => {
    const prisma = prismaFake({
      findUnique: {
        chave: 'chave-44-digitos',
        dataEmissao: new Date('2025-09-22'),
        numero: 159843,
      },
    });
    const service = new NotasFiscaisService(prisma as never, configServiceFake() as never);
    const erroEnoent = Object.assign(new Error('nao existe'), { code: 'ENOENT' });
    readFileMock.mockRejectedValue(erroEnoent);

    await expect(service.obterPdf('nota-1')).rejects.toThrow(/pasta compartilhada/);
  });

  it('propaga erro que nao seja ENOENT (ex: permissao negada) em vez de mascarar como "nao encontrado"', async () => {
    const prisma = prismaFake({
      findUnique: {
        chave: 'chave-44-digitos',
        dataEmissao: new Date('2025-09-22'),
        numero: 159843,
      },
    });
    const service = new NotasFiscaisService(prisma as never, configServiceFake() as never);
    const erroPermissao = Object.assign(new Error('permissao negada'), { code: 'EACCES' });
    readFileMock.mockRejectedValue(erroPermissao);

    await expect(service.obterPdf('nota-1')).rejects.toThrow('permissao negada');
  });
});
