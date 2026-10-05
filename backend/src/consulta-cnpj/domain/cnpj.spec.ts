import { cnpjEhValido, normalizarCnpj } from './cnpj';

describe('cnpj', () => {
  describe('normalizarCnpj', () => {
    it('remove pontuacao e espacos e coloca em maiusculas', () => {
      expect(normalizarCnpj(' 19.131.243/0001-97 ')).toBe('19131243000197');
      expect(normalizarCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
    });
  });

  describe('cnpjEhValido', () => {
    it('aceita CNPJ numerico valido, com ou sem formatacao', () => {
      expect(cnpjEhValido('19131243000197')).toBe(true);
      expect(cnpjEhValido('19.131.243/0001-97')).toBe(true);
      expect(cnpjEhValido('07127994000150')).toBe(true);
    });

    it('aceita CNPJ alfanumerico valido (exemplo oficial da Receita)', () => {
      expect(cnpjEhValido('12ABC34501DE35')).toBe(true);
      expect(cnpjEhValido('12.ABC.345/01DE-35')).toBe(true);
    });

    it('rejeita digito verificador errado', () => {
      expect(cnpjEhValido('19131243000198')).toBe(false);
      expect(cnpjEhValido('12ABC34501DE36')).toBe(false);
    });

    it('rejeita tamanho errado, caractere invalido e DV com letra', () => {
      expect(cnpjEhValido('1913124300019')).toBe(false);
      expect(cnpjEhValido('191312430001977')).toBe(false);
      expect(cnpjEhValido('1913124300019@')).toBe(false);
      expect(cnpjEhValido('12ABC34501DEA5')).toBe(false);
      expect(cnpjEhValido('')).toBe(false);
    });

    it('rejeita sequencia de um caractere so', () => {
      expect(cnpjEhValido('00000000000000')).toBe(false);
      expect(cnpjEhValido('11111111111111')).toBe(false);
    });
  });
});
