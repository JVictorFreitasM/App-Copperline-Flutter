import { NotFoundException } from '@nestjs/common';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';
import { ClienteTabelaPrecoService } from './cliente-tabela-preco.service';

const ESCOPO_TODOS: EscopoClientes = { tipo: 'TODOS' };
const ESCOPO_PROPRIO: EscopoClientes = { tipo: 'PROPRIO', vendedorId: 'vend-1' };
const ESCOPO_NENHUM: EscopoClientes = { tipo: 'NENHUM' };

function prismaFake(overrides: {
  cliente?: Record<string, unknown> | null;
  associacoes?: { codigo: string }[];
} = {}) {
  return {
    cliente: {
      findUnique: jest
        .fn()
        .mockResolvedValue('cliente' in overrides ? overrides.cliente : { id: 'cli-1' }),
      findFirst: jest
        .fn()
        .mockResolvedValue('cliente' in overrides ? overrides.cliente : { id: 'cli-1' }),
    },
    clienteTabelaPreco: {
      findMany: jest.fn().mockResolvedValue(overrides.associacoes ?? []),
      upsert: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

describe('ClienteTabelaPrecoService.listarPorCliente', () => {
  it('retorna os codigos associados em ordem de criacao', async () => {
    const prisma = prismaFake({ associacoes: [{ codigo: '110' }, { codigo: '205' }] });
    const service = new ClienteTabelaPrecoService(prisma as never);

    const resultado = await service.listarPorCliente('cli-1', ESCOPO_TODOS);

    expect(resultado).toEqual(['110', '205']);
  });

  it('lanca NotFoundException quando o cliente nao existe ou esta fora do escopo', async () => {
    const prisma = prismaFake({ cliente: null });
    const service = new ClienteTabelaPrecoService(prisma as never);

    await expect(service.listarPorCliente('inexistente', ESCOPO_TODOS)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lanca NotFoundException sem consultar o banco quando o escopo e NENHUM', async () => {
    const prisma = prismaFake();
    const service = new ClienteTabelaPrecoService(prisma as never);

    await expect(service.listarPorCliente('cli-1', ESCOPO_NENHUM)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
  });

  it('aplica o where de escopo (vendedor comum nao ve tabelas de cliente fora da carteira)', async () => {
    const prisma = prismaFake({ cliente: null });
    const service = new ClienteTabelaPrecoService(prisma as never);

    await expect(
      service.listarPorCliente('cli-de-outro', ESCOPO_PROPRIO),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.cliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'cli-de-outro',
          vendedores: { some: { vendedorId: 'vend-1' } },
        },
      }),
    );
  });
});

describe('ClienteTabelaPrecoService.associar', () => {
  it('lanca NotFoundException quando o cliente nao existe', async () => {
    const prisma = prismaFake({ cliente: null });
    const service = new ClienteTabelaPrecoService(prisma as never);

    await expect(service.associar('inexistente', '110')).rejects.toThrow(NotFoundException);
    expect(prisma.clienteTabelaPreco.upsert).not.toHaveBeenCalled();
  });

  it('e idempotente - upsert, nao create (POST repetido nao quebra)', async () => {
    const prisma = prismaFake();
    const service = new ClienteTabelaPrecoService(prisma as never);

    await service.associar('cli-1', '110');

    expect(prisma.clienteTabelaPreco.upsert).toHaveBeenCalledWith({
      where: { clienteId_codigo: { clienteId: 'cli-1', codigo: '110' } },
      create: { clienteId: 'cli-1', codigo: '110' },
      update: {},
    });
  });
});

describe('ClienteTabelaPrecoService.desassociar', () => {
  it('lanca NotFoundException quando o cliente nao existe', async () => {
    const prisma = prismaFake({ cliente: null });
    const service = new ClienteTabelaPrecoService(prisma as never);

    await expect(service.desassociar('inexistente', '110')).rejects.toThrow(NotFoundException);
  });

  it('remove a associacao pelo par cliente+codigo', async () => {
    const prisma = prismaFake();
    const service = new ClienteTabelaPrecoService(prisma as never);

    await service.desassociar('cli-1', '110');

    expect(prisma.clienteTabelaPreco.deleteMany).toHaveBeenCalledWith({
      where: { clienteId: 'cli-1', codigo: '110' },
    });
  });
});
