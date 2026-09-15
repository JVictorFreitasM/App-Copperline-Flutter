import { NotFoundException } from '@nestjs/common';
import { TiposAcondicionamentoService } from './tipos-acondicionamento.service';

function tipoFake(overrides: Record<string, unknown> = {}) {
  return { id: 't1', nome: 'Caixa', ativo: true, tamanhoPadrao: null, ...overrides };
}

function prismaFake(overrides: {
  findMany?: unknown[];
  findUnique?: unknown;
} = {}) {
  return {
    tipoAcondicionamento: {
      findMany: jest.fn().mockResolvedValue(overrides.findMany ?? []),
      findUnique: jest.fn().mockResolvedValue(
        'findUnique' in overrides ? overrides.findUnique : tipoFake(),
      ),
      create: jest.fn().mockImplementation(({ data }) => tipoFake(data)),
      update: jest.fn().mockImplementation(({ data }) => ({ ...tipoFake(), ...data })),
    },
  };
}

describe('TiposAcondicionamentoService.listarAtivos', () => {
  it('filtra so os ativos', async () => {
    const prisma = prismaFake({ findMany: [tipoFake()] });
    const service = new TiposAcondicionamentoService(prisma as never);

    await service.listarAtivos();

    expect(prisma.tipoAcondicionamento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ativo: true } }),
    );
  });
});

describe('TiposAcondicionamentoService.listarTodos', () => {
  it('nao filtra por ativo', async () => {
    const prisma = prismaFake({ findMany: [tipoFake({ ativo: false })] });
    const service = new TiposAcondicionamentoService(prisma as never);

    const resultado = await service.listarTodos();

    expect(prisma.tipoAcondicionamento.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({ where: expect.anything() }),
    );
    expect(resultado).toEqual([{ id: 't1', nome: 'Caixa', ativo: false, tamanhoPadrao: null }]);
  });
});

describe('TiposAcondicionamentoService.criar', () => {
  it('cria com o nome informado, sem tamanhoPadrao (retalho por padrao)', async () => {
    const prisma = prismaFake();
    const service = new TiposAcondicionamentoService(prisma as never);

    const resultado = await service.criar({ nome: 'Bobina' });

    expect(prisma.tipoAcondicionamento.create).toHaveBeenCalledWith({
      data: { nome: 'Bobina', tamanhoPadrao: undefined },
    });
    expect(resultado.nome).toBe('Bobina');
    expect(resultado.tamanhoPadrao).toBeNull();
  });

  it('cria com tamanhoPadrao (tipo de tamanho fixo)', async () => {
    const prisma = prismaFake();
    const service = new TiposAcondicionamentoService(prisma as never);

    const resultado = await service.criar({ nome: 'Rolo 100m', tamanhoPadrao: 100 });

    expect(prisma.tipoAcondicionamento.create).toHaveBeenCalledWith({
      data: { nome: 'Rolo 100m', tamanhoPadrao: 100 },
    });
    expect(resultado.tamanhoPadrao).toBe('100');
  });
});

describe('TiposAcondicionamentoService.atualizar', () => {
  it('lanca NotFoundException quando o tipo nao existe', async () => {
    const prisma = prismaFake({ findUnique: null });
    const service = new TiposAcondicionamentoService(prisma as never);

    await expect(
      service.atualizar('inexistente', { ativo: false }),
    ).rejects.toThrow(NotFoundException);
  });

  it('permite desativar sem apagar (produto associado nao fica orfao)', async () => {
    const prisma = prismaFake();
    const service = new TiposAcondicionamentoService(prisma as never);

    await service.atualizar('t1', { ativo: false });

    expect(prisma.tipoAcondicionamento.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { nome: undefined, ativo: false, tamanhoPadrao: undefined },
    });
  });

  it('limpa tamanhoPadrao quando null explicito (volta a ser retalho)', async () => {
    const prisma = prismaFake();
    const service = new TiposAcondicionamentoService(prisma as never);

    await service.atualizar('t1', { tamanhoPadrao: null });

    expect(prisma.tipoAcondicionamento.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { nome: undefined, ativo: undefined, tamanhoPadrao: null },
    });
  });
});
