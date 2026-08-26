import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { VendedoresHierarquiaService } from './vendedores-hierarquia.service';

const IDP_USER = { sub: 's1', email: 'a@a.com', name: 'A', role: null, system: 'x' };

function vendedorEscopoServiceFake(
  escopo: Record<string, unknown> = { tipo: 'TODOS' },
) {
  return { resolverEscopoVendedores: jest.fn().mockResolvedValue(escopo) };
}

function prismaFake(vendedores: Record<string, unknown>[]) {
  const linhas = new Map(vendedores.map((v) => [v.id as string, { ...v }]));
  return {
    vendedor: {
      findMany: jest.fn().mockImplementation(
        async (args: { where?: { id?: { in: string[] } } } = {}) => {
        const idsPermitidos = args.where?.id?.in;
        const todas = [...linhas.values()].filter(
          (linha) => !idsPermitidos || idsPermitidos.includes(linha.id as string),
        );
        todas.sort((a, b) => String(a.nome ?? '').localeCompare(String(b.nome ?? '')));
        return todas.map((linha) => ({
          id: linha.id,
          nome: linha.nome,
          email: linha.email ?? null,
          inativo: linha.inativo ?? false,
          papel: linha.papel,
          supervisorId: linha.supervisorId,
          supervisor: linha.supervisorId
            ? { nome: linhas.get(linha.supervisorId as string)?.nome ?? null }
            : null,
        }));
      }),
      findUnique: jest.fn().mockImplementation(
        async ({ where: { id }, select }: { where: { id: string }; select?: Record<string, boolean> }) => {
          const linha = linhas.get(id);
          if (!linha) return null;
          if (select) {
            const projetado: Record<string, unknown> = {};
            for (const campo of Object.keys(select)) {
              projetado[campo] = linha[campo];
            }
            return projetado;
          }
          return linha;
        },
      ),
      update: jest.fn().mockImplementation(
        async ({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const linha = linhas.get(id)!;
          const atualizado = {
            ...linha,
            ...(data.papel !== undefined ? { papel: data.papel } : {}),
            ...(data.supervisorId !== undefined ? { supervisorId: data.supervisorId } : {}),
          };
          linhas.set(id, atualizado);
          return atualizado;
        },
      ),
    },
  };
}

describe('VendedoresHierarquiaService.listar', () => {
  it('retorna todos os vendedores com o nome do supervisor resolvido', async () => {
    const prisma = prismaFake([
      { id: 'sup1', nome: 'Ana Supervisora', papel: 'SUPERVISOR', supervisorId: null },
      { id: 'v1', nome: 'Beto Vendedor', papel: 'VENDEDOR', supervisorId: 'sup1' },
    ]);
    const service = new VendedoresHierarquiaService(prisma as never, vendedorEscopoServiceFake() as never);

    const resultado = await service.listar();

    expect(resultado).toEqual([
      {
        id: 'sup1',
        nome: 'Ana Supervisora',
        email: null,
        inativo: false,
        papel: 'SUPERVISOR',
        supervisorId: null,
        supervisorNome: null,
      },
      {
        id: 'v1',
        nome: 'Beto Vendedor',
        email: null,
        inativo: false,
        papel: 'VENDEDOR',
        supervisorId: 'sup1',
        supervisorNome: 'Ana Supervisora',
      },
    ]);
  });

  it('retorna lista vazia quando nao ha vendedores', async () => {
    const prisma = prismaFake([]);
    const service = new VendedoresHierarquiaService(prisma as never, vendedorEscopoServiceFake() as never);

    expect(await service.listar()).toEqual([]);
  });
});

describe('VendedoresHierarquiaService.atualizar', () => {
  it('atualiza papel e supervisorId quando validos', async () => {
    const prisma = prismaFake([
      { id: 'v1', nome: 'Vendedor 1', papel: 'VENDEDOR', supervisorId: null },
      { id: 'sup1', nome: 'Supervisor 1', papel: 'SUPERVISOR', supervisorId: null },
    ]);
    const service = new VendedoresHierarquiaService(prisma as never, vendedorEscopoServiceFake() as never);

    const resultado = await service.atualizar('v1', {
      papel: 'VENDEDOR',
      supervisorId: 'sup1',
    });

    expect(resultado).toEqual({
      id: 'v1',
      nome: 'Vendedor 1',
      papel: 'VENDEDOR',
      supervisorId: 'sup1',
    });
  });

  it('permite remover o supervisor com supervisorId: null', async () => {
    const prisma = prismaFake([
      { id: 'v1', nome: 'Vendedor 1', papel: 'VENDEDOR', supervisorId: 'sup1' },
    ]);
    const service = new VendedoresHierarquiaService(prisma as never, vendedorEscopoServiceFake() as never);

    const resultado = await service.atualizar('v1', { supervisorId: null });

    expect(resultado.supervisorId).toBeNull();
  });

  it('lanca NotFoundException quando o vendedor nao existe', async () => {
    const prisma = prismaFake([]);
    const service = new VendedoresHierarquiaService(prisma as never, vendedorEscopoServiceFake() as never);

    await expect(
      service.atualizar('inexistente', { papel: 'SUPERVISOR' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanca BadRequestException quando supervisorId aponta pra si mesmo', async () => {
    const prisma = prismaFake([
      { id: 'v1', nome: 'Vendedor 1', papel: 'VENDEDOR', supervisorId: null },
    ]);
    const service = new VendedoresHierarquiaService(prisma as never, vendedorEscopoServiceFake() as never);

    await expect(
      service.atualizar('v1', { supervisorId: 'v1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanca NotFoundException quando o supervisorId proposto nao existe', async () => {
    const prisma = prismaFake([
      { id: 'v1', nome: 'Vendedor 1', papel: 'VENDEDOR', supervisorId: null },
    ]);
    const service = new VendedoresHierarquiaService(prisma as never, vendedorEscopoServiceFake() as never);

    await expect(
      service.atualizar('v1', { supervisorId: 'inexistente' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanca BadRequestException quando supervisorId criaria um ciclo', async () => {
    // a -> b -> c (c.supervisorId = b, b.supervisorId = a) - tentar fazer
    // a.supervisorId = c criaria um ciclo a->c->b->a.
    const prisma = prismaFake([
      { id: 'a', nome: 'A', papel: 'GERENTE', supervisorId: null },
      { id: 'b', nome: 'B', papel: 'SUPERVISOR', supervisorId: 'a' },
      { id: 'c', nome: 'C', papel: 'SUPERVISOR', supervisorId: 'b' },
    ]);
    const service = new VendedoresHierarquiaService(prisma as never, vendedorEscopoServiceFake() as never);

    await expect(
      service.atualizar('a', { supervisorId: 'c' }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('VendedoresHierarquiaService.listarEquipe', () => {
  it('lanca ForbiddenException quando o escopo e PROPRIO', async () => {
    const prisma = prismaFake([]);
    const service = new VendedoresHierarquiaService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'PROPRIO', vendedorId: 'v1' }) as never,
    );

    await expect(service.listarEquipe(IDP_USER as never, 'u1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lanca ForbiddenException quando o escopo e NENHUM', async () => {
    const prisma = prismaFake([]);
    const service = new VendedoresHierarquiaService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'NENHUM' }) as never,
    );

    await expect(service.listarEquipe(IDP_USER as never, 'u1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('escopo EQUIPE retorna so id/nome dos vendedores da equipe', async () => {
    const prisma = prismaFake([
      { id: 'v1', nome: 'Beto', papel: 'VENDEDOR', supervisorId: 'sup1' },
      { id: 'v2', nome: 'Ana', papel: 'VENDEDOR', supervisorId: 'sup1' },
      { id: 'fora', nome: 'Fora Da Equipe', papel: 'VENDEDOR', supervisorId: null },
    ]);
    const service = new VendedoresHierarquiaService(
      prisma as never,
      vendedorEscopoServiceFake({ tipo: 'EQUIPE', vendedorIds: ['v1', 'v2'] }) as never,
    );

    const resultado = await service.listarEquipe(IDP_USER as never, 'u-sup');

    expect(resultado.map((v) => v.id).sort()).toEqual(['v1', 'v2']);
  });
});
