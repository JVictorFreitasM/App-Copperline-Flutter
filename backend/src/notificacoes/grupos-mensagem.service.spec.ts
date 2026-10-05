import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { GruposMensagemService } from './grupos-mensagem.service';

function grupoBruto() {
  return { id: 'g1', nome: 'Sul', membros: [{ vendedorId: 'v1' }, { vendedorId: 'v2' }] };
}

function prismaFake(overrides: {
  grupoPorNome?: { id: string } | null;
  grupoPorId?: { id: string } | null;
  vendedoresExistentes?: number;
} = {}) {
  const grupoMensagem = {
    findMany: jest.fn().mockResolvedValue([grupoBruto()]),
    findUnique: jest
      .fn()
      .mockImplementation(async ({ where }: { where: { id?: string; nome?: string } }) => {
        if (where.nome !== undefined) return overrides.grupoPorNome ?? null;
        return 'grupoPorId' in overrides ? overrides.grupoPorId : { id: where.id };
      }),
    create: jest.fn().mockResolvedValue(grupoBruto()),
    update: jest.fn().mockReturnValue('update-op'),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const grupoMensagemMembro = { deleteMany: jest.fn().mockReturnValue('deleteMany-op') };
  return {
    grupoMensagem,
    grupoMensagemMembro,
    vendedor: { count: jest.fn().mockResolvedValue(overrides.vendedoresExistentes ?? 2) },
    $transaction: jest.fn().mockResolvedValue([undefined, grupoBruto()]),
  };
}

describe('GruposMensagemService', () => {
  it('listar: devolve id, nome e ids dos vendedores', async () => {
    const service = new GruposMensagemService(prismaFake() as never);

    await expect(service.listar()).resolves.toEqual([
      { id: 'g1', nome: 'Sul', vendedorIds: ['v1', 'v2'] },
    ]);
  });

  it('criar: grava o grupo com os membros', async () => {
    const prisma = prismaFake();
    const service = new GruposMensagemService(prisma as never);

    await service.criar({ nome: 'Sul', vendedorIds: ['v1', 'v2'] });

    expect(prisma.grupoMensagem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { nome: 'Sul', membros: { create: [{ vendedorId: 'v1' }, { vendedorId: 'v2' }] } },
      }),
    );
  });

  it('criar: nome repetido -> 409, sem gravar', async () => {
    const prisma = prismaFake({ grupoPorNome: { id: 'outro' } });
    const service = new GruposMensagemService(prisma as never);

    await expect(service.criar({ nome: 'Sul', vendedorIds: [] })).rejects.toThrow(ConflictException);
    expect(prisma.grupoMensagem.create).not.toHaveBeenCalled();
  });

  it('criar: vendedor inexistente -> 422, sem gravar', async () => {
    const prisma = prismaFake({ vendedoresExistentes: 1 });
    const service = new GruposMensagemService(prisma as never);

    await expect(
      service.criar({ nome: 'Sul', vendedorIds: ['v1', 'fantasma'] }),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(prisma.grupoMensagem.create).not.toHaveBeenCalled();
  });

  it('atualizar: aceita manter o proprio nome e troca os membros numa transacao', async () => {
    const prisma = prismaFake({ grupoPorNome: { id: 'g1' }, vendedoresExistentes: 1 });
    const service = new GruposMensagemService(prisma as never);

    await service.atualizar('g1', { nome: 'Sul', vendedorIds: ['v1'] });

    expect(prisma.grupoMensagemMembro.deleteMany).toHaveBeenCalledWith({ where: { grupoId: 'g1' } });
    expect(prisma.$transaction).toHaveBeenCalledWith(['deleteMany-op', 'update-op']);
  });

  it('atualizar: nome ja usado por OUTRO grupo -> 409', async () => {
    const prisma = prismaFake({ grupoPorNome: { id: 'g2' } });
    const service = new GruposMensagemService(prisma as never);

    await expect(service.atualizar('g1', { nome: 'Sul', vendedorIds: [] })).rejects.toThrow(
      ConflictException,
    );
  });

  it('atualizar/remover: grupo inexistente -> 404', async () => {
    const prisma = prismaFake({ grupoPorId: null });
    const service = new GruposMensagemService(prisma as never);

    await expect(service.atualizar('x', { nome: 'A', vendedorIds: [] })).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.remover('x')).rejects.toThrow(NotFoundException);
  });

  it('remover: apaga o grupo', async () => {
    const prisma = prismaFake();
    const service = new GruposMensagemService(prisma as never);

    await service.remover('g1');

    expect(prisma.grupoMensagem.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
  });
});
