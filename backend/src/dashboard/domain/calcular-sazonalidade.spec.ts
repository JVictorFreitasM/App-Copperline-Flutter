import { calcularVariacaoAnoAnterior, gerarSerieMensal } from './calcular-sazonalidade';

describe('gerarSerieMensal', () => {
  it('gera 13 meses (atual + 12 anteriores), com zero nos meses sem venda', () => {
    const hoje = new Date('2026-06-15T00:00:00.000Z');
    const serie = gerarSerieMensal(
      [{ data: new Date('2026-06-05T00:00:00.000Z'), valor: 1000 }],
      hoje,
    );

    expect(serie).toHaveLength(13);
    expect(serie[0].mesAno).toBe('2025-06');
    expect(serie[serie.length - 1]).toEqual({ mesAno: '2026-06', valorVendido: 1000 });
    expect(serie[serie.length - 2].valorVendido).toBe(0);
  });

  it('soma multiplas vendas do mesmo mes', () => {
    const hoje = new Date('2026-06-15T00:00:00.000Z');
    const serie = gerarSerieMensal(
      [
        { data: new Date('2026-06-01T00:00:00.000Z'), valor: 500 },
        { data: new Date('2026-06-20T00:00:00.000Z'), valor: 300 },
      ],
      hoje,
    );

    expect(serie[serie.length - 1].valorVendido).toBe(800);
  });
});

describe('calcularVariacaoAnoAnterior', () => {
  it('retorna null quando a serie tem menos de 13 meses', () => {
    expect(calcularVariacaoAnoAnterior([{ mesAno: '2026-06', valorVendido: 100 }])).toBeNull();
  });

  it('retorna null quando o mesmo mes do ano anterior nao teve nenhuma venda (sem base de comparacao)', () => {
    const serie = Array.from({ length: 13 }, (_, i) => ({
      mesAno: `mes-${i}`,
      valorVendido: i === 0 ? 0 : 100,
    }));
    expect(calcularVariacaoAnoAnterior(serie)).toBeNull();
  });

  it('calcula o percentual de variacao corretamente (crescimento)', () => {
    const serie = Array.from({ length: 13 }, (_, i) => ({
      mesAno: `mes-${i}`,
      valorVendido: i === 0 ? 1000 : 0,
    }));
    serie[serie.length - 1] = { mesAno: 'atual', valorVendido: 1500 };
    expect(calcularVariacaoAnoAnterior(serie)).toBe(50);
  });

  it('calcula o percentual de variacao corretamente (queda)', () => {
    const serie = Array.from({ length: 13 }, (_, i) => ({
      mesAno: `mes-${i}`,
      valorVendido: i === 0 ? 1000 : 0,
    }));
    serie[serie.length - 1] = { mesAno: 'atual', valorVendido: 800 };
    expect(calcularVariacaoAnoAnterior(serie)).toBe(-20);
  });
});
