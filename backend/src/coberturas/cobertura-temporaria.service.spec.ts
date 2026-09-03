import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CoberturaTemporariaService } from './cobertura-temporaria.service';

function prismaFake(overrides: {
  vendedores?: Record<string, Record<string, unknown> | null>;
  criada?: Record<string, unknown>;
}) {
  const vendedores = overrides.vendedores ?? {};
  return {
    vendedor: {
      findUnique: jest
        .fn()
        .mockImplementation(async ({ where: { id } }: { where: { id: string } }) =>
          id in vendedores ? vendedores[id] : { id, nome: `Vendedor ${id}` },
        ),
    },
    coberturaTemporaria: {
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'cob-1',
        ...data,
      })),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe('CoberturaTemporariaService.criar', () => {
  it('lanca BadRequestException quando vendedorOriginal e vendedorSubstituto sao o mesmo', async () => {
    const prisma = prismaFake({});
    const service = new CoberturaTemporariaService(prisma as never);

    await expect(
      service.criar({
        vendedorOriginalId: 'v1',
        vendedorSubstitutoId: 'v1',
        dataInicio: '2026-06-01',
        dataFim: '2026-06-30',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanca BadRequestException quando dataFim nao e posterior a dataInicio', async () => {
    const prisma = prismaFake({});
    const service = new CoberturaTemporariaService(prisma as never);

    await expect(
      service.criar({
        vendedorOriginalId: 'v1',
        vendedorSubstitutoId: 'v2',
        dataInicio: '2026-06-30',
        dataFim: '2026-06-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanca NotFoundException quando o vendedor original nao existe', async () => {
    const prisma = prismaFake({ vendedores: { v1: null } });
    const service = new CoberturaTemporariaService(prisma as never);

    await expect(
      service.criar({
        vendedorOriginalId: 'v1',
        vendedorSubstitutoId: 'v2',
        dataInicio: '2026-06-01',
        dataFim: '2026-06-30',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('cria a cobertura quando os dados sao validos', async () => {
    const prisma = prismaFake({});
    const service = new CoberturaTemporariaService(prisma as never);

    const resultado = await service.criar({
      vendedorOriginalId: 'v1',
      vendedorSubstitutoId: 'v2',
      dataInicio: '2026-06-01',
      dataFim: '2026-06-30',
    });

    expect(resultado.vendedorOriginalId).toBe('v1');
    expect(resultado.vendedorSubstitutoId).toBe('v2');
    expect(prisma.coberturaTemporaria.create).toHaveBeenCalled();
  });
});
