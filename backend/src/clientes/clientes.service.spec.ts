import { NotFoundException } from '@nestjs/common';
import type { EscopoClientes } from '../vendedores/vendedor-escopo.service';
import { ClientesService } from './clientes.service';
import type { ListarClientesQueryDto } from './dto/listar-clientes-query.dto';

const ESCOPO_TODOS: EscopoClientes = { tipo: 'TODOS' };

function prismaFake(overrides: {
  findMany?: unknown[];
  count?: number;
  findFirst?: unknown;
}) {
  const findMany = jest.fn().mockResolvedValue(overrides.findMany ?? []);
  const count = jest.fn().mockResolvedValue(overrides.count ?? 0);
  const findFirst = jest.fn().mockResolvedValue(overrides.findFirst ?? null);

  return {
    cliente: { findMany, count, findFirst },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

describe('ClientesService.listar', () => {
  it('pagina corretamente e mapeia os clientes pro DTO de resumo', async () => {
    const clientesBrutos = [
      {
        id: '1',
        idExternoErp: 'ext-1',
        cpfCnpj: '123',
        razaoSocial: 'Cliente A',
        nomeFantasia: null,
        inativo: false,
        incompleto: false,
        sincronizadoEm: new Date('2026-01-01'),
      },
    ];
    const prisma = prismaFake({ findMany: clientesBrutos, count: 1 });
    const service = new ClientesService(prisma as never);

    const query: ListarClientesQueryDto = { page: 1, limit: 20 };
    const resultado = await service.listar(query, ESCOPO_TODOS);

    expect(resultado.data).toEqual([
      {
        id: '1',
        idExternoErp: 'ext-1',
        cpfCnpj: '123',
        razaoSocial: 'Cliente A',
        nomeFantasia: null,
        inativo: false,
        incompleto: false,
        sincronizadoEm: new Date('2026-01-01'),
      },
    ]);
    expect(resultado.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it('aplica skip/take de acordo com page/limit', async () => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new ClientesService(prisma as never);

    await service.listar({ page: 3, limit: 10 }, ESCOPO_TODOS);

    expect(prisma.cliente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });

  it('escopo NENHUM retorna lista vazia sem consultar o banco', async () => {
    const prisma = prismaFake({ findMany: [{ id: '1' }], count: 1 });
    const service = new ClientesService(prisma as never);

    const resultado = await service.listar(
      { page: 1, limit: 20 },
      { tipo: 'NENHUM' },
    );

    expect(resultado.data).toEqual([]);
    expect(resultado.meta.total).toBe(0);
    expect(prisma.cliente.findMany).not.toHaveBeenCalled();
  });

  it('escopo PROPRIO filtra por vendedorId no where', async () => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new ClientesService(prisma as never);

    await service.listar(
      { page: 1, limit: 20 },
      { tipo: 'PROPRIO', vendedorId: 'v1' },
    );

    expect(prisma.cliente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vendedores: { some: { vendedorId: 'v1' } },
        }),
      }),
    );
  });

  it('escopo EQUIPE filtra pela lista de vendedorIds no where', async () => {
    const prisma = prismaFake({ findMany: [], count: 0 });
    const service = new ClientesService(prisma as never);

    await service.listar(
      { page: 1, limit: 20 },
      { tipo: 'EQUIPE', vendedorIds: ['v1', 'v2'] },
    );

    expect(prisma.cliente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vendedores: { some: { vendedorId: { in: ['v1', 'v2'] } } },
        }),
      }),
    );
  });
});

describe('ClientesService.buscarPorId', () => {
  it('lança NotFoundException quando o cliente nao existe', async () => {
    const prisma = prismaFake({ findFirst: null });
    const service = new ClientesService(prisma as never);

    await expect(
      service.buscarPorId('inexistente', ESCOPO_TODOS),
    ).rejects.toThrow(NotFoundException);
  });

  it('lança NotFoundException (nao 403) quando o cliente existe mas esta fora do escopo NENHUM', async () => {
    const prisma = prismaFake({ findFirst: { id: '1' } });
    const service = new ClientesService(prisma as never);

    await expect(
      service.buscarPorId('1', { tipo: 'NENHUM' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
  });

  it('retorna o detalhe com contatos mapeados quando o cliente existe no escopo', async () => {
    const prisma = prismaFake({
      findFirst: {
        id: '1',
        idExternoErp: 'ext-1',
        cpfCnpj: '123',
        razaoSocial: 'Cliente A',
        nomeFantasia: null,
        inativo: false,
        incompleto: false,
        sincronizadoEm: new Date('2026-01-01'),
        enderecos: [],
        contatos: [
          {
            id: 'c1',
            nome: 'Fulano',
            email: 'fulano@example.com',
            telefoneDdd: '11',
            telefoneNumero: '999999999',
            funcao: 'Comprador',
          },
        ],
      },
    });
    const service = new ClientesService(prisma as never);

    const resultado = await service.buscarPorId('1', ESCOPO_TODOS);

    expect(resultado.contatos).toEqual([
      {
        id: 'c1',
        nome: 'Fulano',
        email: 'fulano@example.com',
        telefoneDdd: '11',
        telefoneNumero: '999999999',
        funcao: 'Comprador',
      },
    ]);
  });
});

describe('ClientesService.verificarConflito', () => {
  it('retorna existe:false quando nenhum cliente bate com o documento', async () => {
    const prisma = prismaFake({ findFirst: null });
    const service = new ClientesService(prisma as never);

    const resultado = await service.verificarConflito('123.456.789-00');

    expect(resultado).toEqual({ existe: false, vendedorResponsavel: null });
  });

  it('normaliza o documento (remove mascara) antes de buscar', async () => {
    const prisma = prismaFake({ findFirst: null });
    const service = new ClientesService(prisma as never);

    await service.verificarConflito('123.456.789-00');

    expect(prisma.cliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cpfCnpj: '12345678900' } }),
    );
  });

  it('retorna existe:true e o nome do vendedor responsavel quando ha match', async () => {
    const prisma = prismaFake({
      findFirst: {
        vendedores: [{ vendedor: { nome: 'Fulano Vendedor' } }],
      },
    });
    const service = new ClientesService(prisma as never);

    const resultado = await service.verificarConflito('12345678900');

    expect(resultado).toEqual({
      existe: true,
      vendedorResponsavel: 'Fulano Vendedor',
    });
  });

  it('retorna vendedorResponsavel:null quando o cliente existe mas nao tem vendedor vinculado', async () => {
    const prisma = prismaFake({ findFirst: { vendedores: [] } });
    const service = new ClientesService(prisma as never);

    const resultado = await service.verificarConflito('12345678900');

    expect(resultado).toEqual({ existe: true, vendedorResponsavel: null });
  });
});
