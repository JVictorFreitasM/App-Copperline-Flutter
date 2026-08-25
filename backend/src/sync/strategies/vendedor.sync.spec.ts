import { VendedorSyncStrategy } from './vendedor.sync';
import type { WkRadarVendedor } from './vendedor.types';

function prismaFake(overrides: { usuarioEncontrado?: { id: string } | null } = {}) {
  const usuarioFindFirst = jest
    .fn()
    .mockResolvedValue(
      'usuarioEncontrado' in overrides ? overrides.usuarioEncontrado : null,
    );
  const vendedorUpsert = jest.fn().mockResolvedValue(undefined);
  return {
    usuario: { findFirst: usuarioFindFirst },
    vendedor: { upsert: vendedorUpsert },
  };
}

describe('VendedorSyncStrategy.map', () => {
  const strategy = new VendedorSyncStrategy(undefined as never, undefined as never);

  it('mapeia os campos-chave e usa null para ausentes', () => {
    const bruto: WkRadarVendedor = {
      id: '789',
      codigoIntegrador: null,
      codigo: 'VEND-1',
      nome: 'Vendedor Teste',
      email: 'vendedor@copperline.com.br',
      inativo: false,
    };

    expect(strategy.map(bruto)).toEqual({
      idExternoErp: '789',
      codigoIntegrador: null,
      codigo: 'VEND-1',
      nome: 'Vendedor Teste',
      email: 'vendedor@copperline.com.br',
      inativo: false,
    });
  });
});

describe('VendedorSyncStrategy.fetch', () => {
  it('busca a lista inteira numa unica chamada, ignorando a janela recebida', async () => {
    const get = jest.fn().mockResolvedValue([{ id: '1', inativo: false }]);
    const erpClientFake = { get } as never;
    const strategy = new VendedorSyncStrategy(erpClientFake, undefined as never);

    const resultado = await strategy.fetch({
      desde: new Date('2020-01-01T00:00:00Z'),
      ate: new Date('2026-01-01T00:00:00Z'),
    });

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(
      '/empresarial/v1/vendedor',
      expect.objectContaining({ Situacao: 'Todos' }),
    );
    expect(resultado.registros).toEqual([{ id: '1', inativo: false }]);
  });

  it('sinaliza aviso quando a busca retorna contagem suspeita de truncamento', async () => {
    const paginaGrande = Array.from({ length: 100 }, (_, i) => ({
      id: `v${i}`,
      inativo: false,
    }));
    const get = jest.fn().mockResolvedValue(paginaGrande);
    const erpClientFake = { get } as never;
    const strategy = new VendedorSyncStrategy(erpClientFake, undefined as never);

    const resultado = await strategy.fetch({
      desde: new Date('2026-01-01T00:00:00Z'),
      ate: new Date('2026-01-01T00:00:00Z'),
    });

    expect(resultado.avisos).toHaveLength(1);
    expect(resultado.avisos[0]).toMatch(/100 registro/);
  });
});

describe('VendedorSyncStrategy.upsert', () => {
  it('vincula ao usuario correspondente por e-mail (case-insensitive) quando existe', async () => {
    const prisma = prismaFake({ usuarioEncontrado: { id: 'u1' } });
    const strategy = new VendedorSyncStrategy(undefined as never, prisma as never);

    await strategy.upsert({
      idExternoErp: '789',
      codigoIntegrador: null,
      codigo: 'VEND-1',
      nome: 'Vendedor Teste',
      email: 'Vendedor@Copperline.com.br',
      inativo: false,
    });

    expect(prisma.usuario.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'Vendedor@Copperline.com.br', mode: 'insensitive' } },
      select: { id: true },
    });
    expect(prisma.vendedor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idExternoErp: '789' },
        create: expect.objectContaining({
          usuarioId: 'u1',
          semCorrespondenciaUsuario: false,
        }),
        update: expect.objectContaining({
          usuarioId: 'u1',
          semCorrespondenciaUsuario: false,
        }),
      }),
    );
  });

  it('sinaliza semCorrespondenciaUsuario:true sem lancar erro quando nao ha vendedor.email', async () => {
    const prisma = prismaFake();
    const strategy = new VendedorSyncStrategy(undefined as never, prisma as never);

    await expect(
      strategy.upsert({
        idExternoErp: '790',
        codigoIntegrador: null,
        codigo: 'VEND-2',
        nome: 'Vendedor Sem Email',
        email: null,
        inativo: false,
      }),
    ).resolves.toBeUndefined();

    expect(prisma.usuario.findFirst).not.toHaveBeenCalled();
    expect(prisma.vendedor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          usuarioId: null,
          semCorrespondenciaUsuario: true,
        }),
      }),
    );
  });

  it('sinaliza semCorrespondenciaUsuario:true sem lancar erro quando o e-mail nao bate com nenhum usuario', async () => {
    const prisma = prismaFake({ usuarioEncontrado: null });
    const strategy = new VendedorSyncStrategy(undefined as never, prisma as never);

    await expect(
      strategy.upsert({
        idExternoErp: '791',
        codigoIntegrador: null,
        codigo: 'VEND-3',
        nome: 'Vendedor Sem Match',
        email: 'ninguem@copperline.com.br',
        inativo: false,
      }),
    ).resolves.toBeUndefined();

    expect(prisma.vendedor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          usuarioId: null,
          semCorrespondenciaUsuario: true,
        }),
      }),
    );
  });
});
