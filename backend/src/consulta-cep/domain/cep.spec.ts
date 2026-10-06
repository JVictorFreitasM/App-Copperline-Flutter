import { cepEhValido, normalizarCep } from './cep';

describe('cep', () => {
  it('normaliza removendo hifen, ponto e espacos', () => {
    expect(normalizarCep(' 01311-902 ')).toBe('01311902');
    expect(normalizarCep('01.311-902')).toBe('01311902');
  });

  it('aceita 8 digitos, com ou sem hifen', () => {
    expect(cepEhValido('01311902')).toBe(true);
    expect(cepEhValido('01311-902')).toBe(true);
  });

  it('rejeita tamanho errado, letras e zeros', () => {
    expect(cepEhValido('123')).toBe(false);
    expect(cepEhValido('013119022')).toBe(false);
    expect(cepEhValido('0131190A')).toBe(false);
    expect(cepEhValido('00000000')).toBe(false);
    expect(cepEhValido('')).toBe(false);
  });
});
