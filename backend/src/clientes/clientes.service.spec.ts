import { NotFoundException } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import type { ListarClientesQueryDto } from './dto/listar-clientes-query.dto';

function prismaFake(overrides: {
  findMany?: unknown[];
  count?: number;
  findUnique?: unknown;
}) {
  const findMany = jest.fn().mockResolvedValue(overrides.findMany ?? []);
  const count = jest.fn().mockResolvedValue(overrides.count ?? 0);
  const findUnique = jest.fn().mockResolvedValue(overrides.findUnique ?? null);

  return {
    cliente: { findMany, count, findUnique },
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
    const resultado = await service.listar(query);

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

    await service.listar({ page: 3, limit: 10 });

    expect(prisma.cliente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });
});

describe('ClientesService.buscarPorId', () => {
  it('lança NotFoundException quando o cliente nao existe', async () => {
    const prisma = prismaFake({ findUnique: null });
    const service = new ClientesService(prisma as never);

    await expect(service.buscarPorId('inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('retorna o detalhe com contatos mapeados quando o cliente existe', async () => {
    const prisma = prismaFake({
      findUnique: {
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

    const resultado = await service.buscarPorId('1');

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
