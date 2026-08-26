import { VendedorEscopoService } from './vendedor-escopo.service';

function prismaFake(vendedores: Record<string, unknown>[]) {
  return {
    vendedor: {
      findFirst: jest.fn().mockImplementation(
        async ({ where: { usuarioId } }: { where: { usuarioId: string } }) =>
          vendedores.find((v) => v.usuarioId === usuarioId) ?? null,
      ),
      findMany: jest.fn().mockImplementation(
        async ({ where: { supervisorId } }: { where: { supervisorId: { in: string[] } } }) =>
          vendedores.filter((v) =>
            supervisorId.in.includes(v.supervisorId as string),
          ),
      ),
    },
  };
}

describe('VendedorEscopoService.resolverEscopoClientes', () => {
  it('retorna TODOS quando o usuario tem role admin no IdP', async () => {
    const prisma = prismaFake([]);
    const service = new VendedorEscopoService(prisma as never);

    const escopo = await service.resolverEscopoClientes(
      { sub: 's1', email: 'a@a.com', name: 'A', role: 'admin', system: 'x' },
      'u1',
    );

    expect(escopo).toEqual({ tipo: 'TODOS' });
  });

  it('retorna NENHUM quando o usuario nao e admin e nao tem Vendedor vinculado', async () => {
    const prisma = prismaFake([]);
    const service = new VendedorEscopoService(prisma as never);

    const escopo = await service.resolverEscopoClientes(
      { sub: 's1', email: 'a@a.com', name: 'A', role: null, system: 'x' },
      'u1',
    );

    expect(escopo).toEqual({ tipo: 'NENHUM' });
  });

  it('retorna PROPRIO com o id do vendedor quando papel e VENDEDOR', async () => {
    const prisma = prismaFake([{ id: 'v1', usuarioId: 'u1', papel: 'VENDEDOR', supervisorId: null }]);
    const service = new VendedorEscopoService(prisma as never);

    const escopo = await service.resolverEscopoClientes(
      { sub: 's1', email: 'a@a.com', name: 'A', role: null, system: 'x' },
      'u1',
    );

    expect(escopo).toEqual({ tipo: 'PROPRIO', vendedorId: 'v1' });
  });

  it('retorna EQUIPE incluindo o proprio supervisor e todos os subordinados (recursivo)', async () => {
    // gerente -> supervisor -> vendedor1, vendedor2
    const prisma = prismaFake([
      { id: 'gerente-1', usuarioId: 'u-gerente', papel: 'GERENTE', supervisorId: null },
      { id: 'supervisor-1', usuarioId: 'u-sup', papel: 'SUPERVISOR', supervisorId: 'gerente-1' },
      { id: 'vendedor-1', usuarioId: 'u-v1', papel: 'VENDEDOR', supervisorId: 'supervisor-1' },
      { id: 'vendedor-2', usuarioId: 'u-v2', papel: 'VENDEDOR', supervisorId: 'supervisor-1' },
    ]);
    const service = new VendedorEscopoService(prisma as never);

    const escopo = await service.resolverEscopoClientes(
      { sub: 's1', email: 'a@a.com', name: 'A', role: null, system: 'x' },
      'u-gerente',
    );

    expect(escopo.tipo).toBe('EQUIPE');
    if (escopo.tipo === 'EQUIPE') {
      expect(new Set(escopo.vendedorIds)).toEqual(
        new Set(['gerente-1', 'supervisor-1', 'vendedor-1', 'vendedor-2']),
      );
    }
  });

  it('retorna EQUIPE so com a propria equipe direta quando papel e SUPERVISOR', async () => {
    const prisma = prismaFake([
      { id: 'gerente-1', usuarioId: 'u-gerente', papel: 'GERENTE', supervisorId: null },
      { id: 'supervisor-1', usuarioId: 'u-sup', papel: 'SUPERVISOR', supervisorId: 'gerente-1' },
      { id: 'vendedor-1', usuarioId: 'u-v1', papel: 'VENDEDOR', supervisorId: 'supervisor-1' },
    ]);
    const service = new VendedorEscopoService(prisma as never);

    const escopo = await service.resolverEscopoClientes(
      { sub: 's1', email: 'a@a.com', name: 'A', role: null, system: 'x' },
      'u-sup',
    );

    expect(escopo.tipo).toBe('EQUIPE');
    if (escopo.tipo === 'EQUIPE') {
      expect(new Set(escopo.vendedorIds)).toEqual(new Set(['supervisor-1', 'vendedor-1']));
    }
  });
});

describe('VendedorEscopoService.resolverEscopoVendedores', () => {
  // Mesma resolucao de resolverEscopoClientes (papel + equipe) so exposta
  // sob outro nome pro caller de OS-WEB-21 (GET /solicitacoes-desconto) -
  // um teste de fumaca confirma que nao ha divergencia entre os dois.
  it('resolve EQUIPE identico a resolverEscopoClientes pro mesmo usuario', async () => {
    const prisma = prismaFake([
      { id: 'sup1', usuarioId: 'u-sup', papel: 'SUPERVISOR', supervisorId: null },
      { id: 'v1', usuarioId: 'u-v1', papel: 'VENDEDOR', supervisorId: 'sup1' },
    ]);
    const service = new VendedorEscopoService(prisma as never);
    const idpUser = { sub: 's1', email: 'a@a.com', name: 'A', role: null, system: 'x' };

    const escopo = await service.resolverEscopoVendedores(idpUser, 'u-sup');

    expect(escopo.tipo).toBe('EQUIPE');
    if (escopo.tipo === 'EQUIPE') {
      expect(new Set(escopo.vendedorIds)).toEqual(new Set(['sup1', 'v1']));
    }
  });
});
