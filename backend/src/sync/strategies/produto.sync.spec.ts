import { ProdutoSyncStrategy } from './produto.sync';
import type { WkRadarProduto } from './produto.types';

describe('ProdutoSyncStrategy.map', () => {
  const configServiceFake = { get: () => undefined } as never;
  const strategy = new ProdutoSyncStrategy(
    undefined as never,
    undefined as never,
    configServiceFake,
  );

  it('mapeia os campos-chave, traduz o enum tipo e usa null para ausentes', () => {
    const bruto: WkRadarProduto = {
      id: '456',
      codigoIntegrador: null,
      codigo: 'PROD-1',
      nome: 'Produto Teste',
      descricao: null,
      tipo: 'Proprio',
      inativo: false,
      precoVenda: 19.9,
      idGrade1: null,
      idGrade2: null,
      idGrade3: null,
      referenciasGrade: null,
      complemento: { gtin: '7891234567890' },
    };

    const mapeado = strategy.map(bruto);

    expect(mapeado).toEqual({
      idExternoErp: '456',
      codigoIntegrador: null,
      codigo: 'PROD-1',
      nome: 'Produto Teste',
      descricao: null,
      tipo: 'PROPRIO',
      inativo: false,
      precoVenda: 19.9,
      gtin: '7891234567890',
      idGrade1: null,
      idGrade2: null,
      idGrade3: null,
      referenciasGrade: [],
      comprimentoMetros: null,
    });
  });

  it('mapeia comprimentoMetros quando unidadeMedidaComprimento e "Metro"', () => {
    const bruto: WkRadarProduto = {
      id: '456',
      inativo: false,
      dimensoes: { comprimento: 30, unidadeMedidaComprimento: 'Metro' },
    };

    expect(strategy.map(bruto).comprimentoMetros).toBe(30);
  });

  it('NAO mapeia comprimentoMetros quando unidadeMedidaComprimento nao e "Metro" (fail-safe)', () => {
    const bruto: WkRadarProduto = {
      id: '456',
      inativo: false,
      dimensoes: { comprimento: 30, unidadeMedidaComprimento: 'Centimetro' },
    };

    expect(strategy.map(bruto).comprimentoMetros).toBeNull();
  });

  it('preserva referenciasGrade sem transformar em linhas proprias (decisao desta OS)', () => {
    const bruto: WkRadarProduto = {
      id: '456',
      inativo: false,
      referenciasGrade: [
        { idItemGrade1: 'cor-azul', idItemGrade2: 'tam-m', referencia: 'AZ-M' },
      ],
    };

    const mapeado = strategy.map(bruto);

    expect(mapeado.referenciasGrade).toEqual([
      { idItemGrade1: 'cor-azul', idItemGrade2: 'tam-m', referencia: 'AZ-M' },
    ]);
  });
});

describe('ProdutoSyncStrategy.fetch', () => {
  it('deduplica registros que se repetem entre sub-janelas sobrepostas (cursor unico sem limite superior)', async () => {
    // Sub-janela 1 (mais antiga) retorna tudo desde entao ate agora,
    // incluindo o produto '2' que a sub-janela 2 (mais recente) tambem
    // retorna - so deve aparecer uma vez no resultado agregado.
    const get = jest
      .fn()
      .mockResolvedValueOnce([
        { id: '1', inativo: false },
        { id: '2', inativo: false },
      ])
      .mockResolvedValueOnce([{ id: '2', inativo: false }]);
    const erpClientFake = { get } as never;
    const configServiceFake = { get: () => 60 * 60 * 1000 } as never; // janela de 1h

    const strategy = new ProdutoSyncStrategy(
      erpClientFake,
      undefined as never,
      configServiceFake,
    );

    const resultado = await strategy.fetch({
      desde: new Date('2026-01-01T00:00:00Z'),
      ate: new Date('2026-01-01T02:00:00Z'),
    });

    expect(get).toHaveBeenCalledTimes(2);
    expect(resultado.registros.map((p) => p.id)).toEqual(['1', '2']);
  });

  it('sinaliza aviso quando uma sub-janela retorna contagem suspeita de truncamento', async () => {
    const paginaGrande = Array.from({ length: 500 }, (_, i) => ({
      id: `p${i}`,
      inativo: false,
    }));
    const get = jest.fn().mockResolvedValueOnce(paginaGrande);
    const erpClientFake = { get } as never;
    const configServiceFake = { get: () => 60 * 60 * 1000 } as never;

    const strategy = new ProdutoSyncStrategy(
      erpClientFake,
      undefined as never,
      configServiceFake,
    );

    const resultado = await strategy.fetch({
      desde: new Date('2026-01-01T00:00:00Z'),
      ate: new Date('2026-01-01T01:00:00Z'),
    });

    expect(resultado.avisos).toHaveLength(1);
    expect(resultado.avisos[0]).toMatch(/500 registro/);
  });
});
