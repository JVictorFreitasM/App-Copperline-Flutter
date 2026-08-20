import { NotFoundException } from '@nestjs/common';
import { NotasFiscaisService } from './notas-fiscais.service';

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
    const service = new NotasFiscaisService(prisma as never);

    const resultado = await service.listar({ page: 1, limit: 20 });

    expect(resultado.aviso).toMatch(/60 dias/);
  });

  it('resolve pedidos vinculados com numero e cliente (nao so o id)', async () => {
    const prisma = prismaFake({ findMany: [NOTA_BRUTA], count: 1 });
    const service = new NotasFiscaisService(prisma as never);

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
    const service = new NotasFiscaisService(prisma as never);

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
    const service = new NotasFiscaisService(prisma as never);

    await expect(service.buscarPorId('inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });
});
