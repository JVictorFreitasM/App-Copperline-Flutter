import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MetaVendedorService } from './meta-vendedor.service';
import { VendedorVendasService } from '../vendedores/vendedor-vendas.service';

function decimalFake(valor: number) {
  return { toNumber: () => valor };
}

function prismaFake(overrides: {
  vendedor?: unknown;
  metaExistente?: unknown;
}) {
  return {
    vendedor: {
      findUnique: jest.fn().mockResolvedValue(overrides.vendedor ?? null),
    },
    metaVendedor: {
      upsert: jest.fn().mockImplementation(async ({ create, update }) => ({
        vendedorId: create.vendedorId,
        periodicidade: create.periodicidade,
        periodo: create.periodo,
        tipoMeta: update.tipoMeta ?? create.tipoMeta,
        valorMeta: decimalFake(update.valorMeta ?? create.valorMeta),
        atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
      })),
      findUnique: jest.fn().mockResolvedValue(overrides.metaExistente ?? null),
    },
  };
}

function vendedorVendasServiceFake(
  valores: Record<string, number> = {},
  pesos: Record<string, number> = {},
) {
  return {
    valorVendidoPorVendedor: jest.fn().mockResolvedValue(new Map(Object.entries(valores))),
    pesoVendidoPorVendedor: jest.fn().mockResolvedValue(new Map(Object.entries(pesos))),
  } as unknown as VendedorVendasService;
}

describe('MetaVendedorService.definir', () => {
  it('lanca NotFoundException quando o vendedor nao existe', async () => {
    const prisma = prismaFake({});
    const service = new MetaVendedorService(prisma as never, vendedorVendasServiceFake());

    await expect(
      service.definir('inexistente', {
        periodicidade: 'MENSAL',
        periodo: '2026-01',
        tipoMeta: 'DINHEIRO',
        valorMeta: 1000,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('cria/atualiza a meta mensal em dinheiro do vendedor pro periodo informado', async () => {
    const prisma = prismaFake({ vendedor: { id: 'v1' } });
    const service = new MetaVendedorService(prisma as never, vendedorVendasServiceFake());

    const resultado = await service.definir('v1', {
      periodicidade: 'MENSAL',
      periodo: '2026-01',
      tipoMeta: 'DINHEIRO',
      valorMeta: 5000,
    });

    expect(resultado).toEqual({
      vendedorId: 'v1',
      periodicidade: 'MENSAL',
      periodo: '2026-01',
      tipoMeta: 'DINHEIRO',
      valorMeta: 5000,
      atualizadoEm: '2026-01-01T00:00:00.000Z',
    });
  });

  // Pedido do usuario (2026-09-28) - "YYYY-Www" so vale pra periodicidade
  // SEMANAL, "YYYY-MM" so pra MENSAL. Trocado (mes com periodicidade
  // semanal ou vice-versa) precisa falhar com mensagem clara.
  it('rejeita periodo em formato mensal quando periodicidade e SEMANAL', async () => {
    const prisma = prismaFake({ vendedor: { id: 'v1' } });
    const service = new MetaVendedorService(prisma as never, vendedorVendasServiceFake());

    await expect(
      service.definir('v1', {
        periodicidade: 'SEMANAL',
        periodo: '2026-01',
        tipoMeta: 'DINHEIRO',
        valorMeta: 5000,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita periodo em formato semanal quando periodicidade e MENSAL', async () => {
    const prisma = prismaFake({ vendedor: { id: 'v1' } });
    const service = new MetaVendedorService(prisma as never, vendedorVendasServiceFake());

    await expect(
      service.definir('v1', {
        periodicidade: 'MENSAL',
        periodo: '2026-W01',
        tipoMeta: 'DINHEIRO',
        valorMeta: 5000,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('aceita periodo em formato semanal (YYYY-Www) quando periodicidade e SEMANAL', async () => {
    const prisma = prismaFake({ vendedor: { id: 'v1' } });
    const service = new MetaVendedorService(prisma as never, vendedorVendasServiceFake());

    const resultado = await service.definir('v1', {
      periodicidade: 'SEMANAL',
      periodo: '2026-W40',
      tipoMeta: 'DINHEIRO',
      valorMeta: 3000,
    });

    expect(resultado.periodicidade).toBe('SEMANAL');
    expect(resultado.periodo).toBe('2026-W40');
  });
});

describe('MetaVendedorService.obterProgresso', () => {
  it('tipoMeta/valorMeta/percentualAtingido ficam null quando nao ha meta configurada pro periodo (nao e "meta zero")', async () => {
    const prisma = prismaFake({ metaExistente: null });
    const service = new MetaVendedorService(
      prisma as never,
      vendedorVendasServiceFake({ v1: 1500 }),
    );

    const resultado = await service.obterProgresso('v1', 'MENSAL', '2026-01');

    expect(resultado).toEqual({
      vendedorId: 'v1',
      periodicidade: 'MENSAL',
      periodo: '2026-01',
      tipoMeta: null,
      valorMeta: null,
      // Sem meta configurada - nem chega a consultar valor vendido (nao
      // faz sentido calcular progresso de uma meta que nao existe).
      valorVendido: 0,
      percentualAtingido: null,
    });
  });

  it('calcula percentualAtingido corretamente pra meta em DINHEIRO', async () => {
    const prisma = prismaFake({
      metaExistente: { tipoMeta: 'DINHEIRO', valorMeta: decimalFake(1000) },
    });
    const service = new MetaVendedorService(
      prisma as never,
      vendedorVendasServiceFake({ v1: 750 }),
    );

    const resultado = await service.obterProgresso('v1', 'MENSAL', '2026-01');

    expect(resultado.tipoMeta).toBe('DINHEIRO');
    expect(resultado.valorMeta).toBe(1000);
    expect(resultado.valorVendido).toBe(750);
    expect(resultado.percentualAtingido).toBe(75);
  });

  it('valorVendido fica 0 quando o vendedor nao aparece no mapa de vendas do periodo', async () => {
    const prisma = prismaFake({
      metaExistente: { tipoMeta: 'DINHEIRO', valorMeta: decimalFake(1000) },
    });
    const service = new MetaVendedorService(prisma as never, vendedorVendasServiceFake({}));

    const resultado = await service.obterProgresso('v1', 'MENSAL', '2026-01');

    expect(resultado.valorVendido).toBe(0);
    expect(resultado.percentualAtingido).toBe(0);
  });

  // Pedido do usuario (2026-09-28) - meta tipo PESO usa
  // pesoVendidoPorVendedor (Kg), nao valorVendidoPorVendedor (R$).
  it('calcula progresso pra meta em PESO usando pesoVendidoPorVendedor (Kg)', async () => {
    const prisma = prismaFake({
      metaExistente: { tipoMeta: 'PESO', valorMeta: decimalFake(500) },
    });
    const vendedorVendasService = vendedorVendasServiceFake({}, { v1: 250 });
    const service = new MetaVendedorService(prisma as never, vendedorVendasService);

    const resultado = await service.obterProgresso('v1', 'MENSAL', '2026-01');

    expect(vendedorVendasService.pesoVendidoPorVendedor).toHaveBeenCalled();
    expect(vendedorVendasService.valorVendidoPorVendedor).not.toHaveBeenCalled();
    expect(resultado.valorVendido).toBe(250);
    expect(resultado.percentualAtingido).toBe(50);
  });

  // Pedido do usuario (2026-09-28): "deixe apenas o nome margem, mas sem
  // calcular nada ainda" - valorVendido sempre 0, percentualAtingido
  // sempre null pra esse tipo, mesmo com valorMeta configurado.
  it('meta tipo MARGEM nunca calcula progresso (so o nome existe por enquanto)', async () => {
    const prisma = prismaFake({
      metaExistente: { tipoMeta: 'MARGEM', valorMeta: decimalFake(1000) },
    });
    const vendedorVendasService = vendedorVendasServiceFake({ v1: 750 }, { v1: 500 });
    const service = new MetaVendedorService(prisma as never, vendedorVendasService);

    const resultado = await service.obterProgresso('v1', 'MENSAL', '2026-01');

    expect(vendedorVendasService.valorVendidoPorVendedor).not.toHaveBeenCalled();
    expect(vendedorVendasService.pesoVendidoPorVendedor).not.toHaveBeenCalled();
    expect(resultado.valorMeta).toBe(1000);
    expect(resultado.valorVendido).toBe(0);
    expect(resultado.percentualAtingido).toBeNull();
  });

  it('aceita e ecoa periodo semanal (YYYY-Www) quando periodicidade e SEMANAL', async () => {
    const prisma = prismaFake({
      metaExistente: { tipoMeta: 'DINHEIRO', valorMeta: decimalFake(1000) },
    });
    const service = new MetaVendedorService(
      prisma as never,
      vendedorVendasServiceFake({ v1: 400 }),
    );

    const resultado = await service.obterProgresso('v1', 'SEMANAL', '2026-W40');

    expect(resultado.periodicidade).toBe('SEMANAL');
    expect(resultado.periodo).toBe('2026-W40');
    expect(resultado.percentualAtingido).toBe(40);
  });

  it('rejeita periodo em formato mensal quando periodicidade e SEMANAL', async () => {
    const prisma = prismaFake({ metaExistente: null });
    const service = new MetaVendedorService(prisma as never, vendedorVendasServiceFake());

    await expect(service.obterProgresso('v1', 'SEMANAL', '2026-01')).rejects.toThrow(
      BadRequestException,
    );
  });
});
