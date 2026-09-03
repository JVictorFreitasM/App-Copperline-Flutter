import { VendedorVendasSemanaisService } from './vendedor-vendas-semanais.service';
import type { VendedorVendasService } from './vendedor-vendas.service';

function redisFake(cacheado: string | null = null) {
  return {
    get: jest.fn().mockResolvedValue(cacheado),
    set: jest.fn().mockResolvedValue('OK'),
  };
}

describe('VendedorVendasSemanaisService.obter', () => {
  it('retorna uma linha por semana, na ordem mais antiga -> mais recente', async () => {
    const vendedorVendasService = {
      valorVendidoPorVendedor: jest.fn().mockResolvedValue(new Map([['v1', 100]])),
    };
    const redis = redisFake();
    const service = new VendedorVendasSemanaisService(
      vendedorVendasService as unknown as VendedorVendasService,
      redis as never,
    );

    const resultado = await service.obter('v1', 4);

    expect(resultado).toHaveLength(4);
    expect(vendedorVendasService.valorVendidoPorVendedor).toHaveBeenCalledTimes(4);
    const datas = resultado.map((r) => r.semanaInicio);
    expect(datas).toEqual([...datas].sort());
  });

  it('semana sem venda do vendedor entra como zero, nao e omitida', async () => {
    const vendedorVendasService = {
      valorVendidoPorVendedor: jest.fn().mockResolvedValue(new Map()),
    };
    const redis = redisFake();
    const service = new VendedorVendasSemanaisService(
      vendedorVendasService as unknown as VendedorVendasService,
      redis as never,
    );

    const resultado = await service.obter('v1', 2);

    expect(resultado.every((r) => r.valorVendido === 0)).toBe(true);
  });

  it('usa o cache quando ja existe, sem consultar vendas de novo', async () => {
    const cacheado = JSON.stringify([{ semanaInicio: '2026-01-01', valorVendido: 42 }]);
    const vendedorVendasService = {
      valorVendidoPorVendedor: jest.fn(),
    };
    const redis = redisFake(cacheado);
    const service = new VendedorVendasSemanaisService(
      vendedorVendasService as unknown as VendedorVendasService,
      redis as never,
    );

    const resultado = await service.obter('v1', 8);

    expect(resultado).toEqual(JSON.parse(cacheado));
    expect(vendedorVendasService.valorVendidoPorVendedor).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });
});
