import { parseDecimalBr } from './parse-decimal-br';

describe('parseDecimalBr', () => {
  it('converte decimal simples ("14,5830" -> "14.5830")', () => {
    expect(parseDecimalBr('14,5830')).toBe('14.5830');
  });

  it('converte decimal com separador de milhar ("4.954,4349" -> "4954.4349")', () => {
    expect(parseDecimalBr('4.954,4349')).toBe('4954.4349');
  });

  it('converte inteiro sem casas decimais ("0" -> "0")', () => {
    expect(parseDecimalBr('0')).toBe('0');
  });

  it('lanca erro para um valor que nao e um numero', () => {
    expect(() => parseDecimalBr('abc')).toThrow();
  });

  it('trata ponto sem virgula como separador de milhar, nao decimal ("1.000" -> "1000")', () => {
    expect(parseDecimalBr('1.000')).toBe('1000');
  });
});
