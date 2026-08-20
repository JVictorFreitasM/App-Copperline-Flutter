import { buildWkBiReportConfig } from './build-wk-bi-report-config';

describe('buildWkBiReportConfig', () => {
  it('monta a string pseudo-INI a partir dos parametros', () => {
    const config = buildWkBiReportConfig({ Modulo: 'ES', CodProdutos: '123' });

    expect(config).toBe('"Modulo"="ES";"CodProdutos"="123";');
  });

  it('rejeita valor contendo aspas duplas em vez de tentar escapar', () => {
    expect(() =>
      buildWkBiReportConfig({ CodProdutos: 'X" ; "Hash"="malicioso' }),
    ).toThrow(/aspas duplas/);
  });
});
