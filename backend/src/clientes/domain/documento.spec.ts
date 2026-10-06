import {
  documentoEhValido,
  formatarDocumento,
  tipoPessoaDoDocumento,
  variantesParaBusca,
} from './documento';

describe('documento', () => {
  it('identifica CPF valido como pessoa fisica, com ou sem pontuacao', () => {
    expect(tipoPessoaDoDocumento('529.982.247-25')).toBe('Fisica');
    expect(tipoPessoaDoDocumento('52998224725')).toBe('Fisica');
  });

  it('identifica CNPJ valido (numerico e alfanumerico) como pessoa juridica', () => {
    expect(tipoPessoaDoDocumento('19.131.243/0001-97')).toBe('Juridica');
    expect(tipoPessoaDoDocumento('12ABC34501DE35')).toBe('Juridica');
  });

  it('rejeita DV errado, tamanho errado e sequencia repetida', () => {
    expect(documentoEhValido('529.982.247-26')).toBe(false);
    expect(documentoEhValido('11111111111')).toBe(false);
    expect(documentoEhValido('19131243000198')).toBe(false);
    expect(documentoEhValido('123')).toBe(false);
    expect(documentoEhValido('')).toBe(false);
  });

  it('formata CPF e CNPJ como o WK Radar grava', () => {
    expect(formatarDocumento('52998224725')).toBe('529.982.247-25');
    expect(formatarDocumento('19131243000197')).toBe('19.131.243/0001-97');
  });

  it('busca na base pelas duas formas (so digitos E formatado)', () => {
    expect(variantesParaBusca('19.131.243/0001-97')).toEqual([
      '19131243000197',
      '19.131.243/0001-97',
    ]);
  });
});
