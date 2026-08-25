import {
  calcularQuantidadePedido,
  ComprimentoNaoConfiguradoError,
  QuantidadeNaoFechaEmUnidadeError,
  TipoVendaNaoConfiguradoError,
} from './calculo-quantidade-pedido';

describe('calcularQuantidadePedido - POC (peca)', () => {
  it('produto POC de 30m com pedido de 90m calcula 3 pecas corretamente (criterio de aceite)', () => {
    const resultado = calcularQuantidadePedido('POC', 30, 10, 90);

    expect(resultado).toEqual({ quantidade: 3, unidade: 'PECA', valorTotal: 900 });
  });

  it('arredonda pra peca inteira mais proxima quando nao divide exatamente', () => {
    // 100 / 30 = 3.33 -> arredonda pra 3 pecas (90m efetivos)
    const resultado = calcularQuantidadePedido('POC', 30, 10, 100);

    expect(resultado.quantidade).toBe(3);
    expect(resultado.valorTotal).toBe(900);
  });

  it('nunca calcula 0 pecas, mesmo com pedido bem menor que o comprimento', () => {
    const resultado = calcularQuantidadePedido('POC', 30, 10, 2);

    expect(resultado.quantidade).toBe(1);
  });

  it('lanca ComprimentoNaoConfiguradoError quando o produto nao tem comprimentoMetros', () => {
    expect(() => calcularQuantidadePedido('POC', null, 10, 90)).toThrow(
      ComprimentoNaoConfiguradoError,
    );
  });
});

describe('calcularQuantidadePedido - RET (retalho)', () => {
  it('aceita valor fracionario sem erro (criterio de aceite)', () => {
    const resultado = calcularQuantidadePedido('RET', null, 10, 12.5);

    expect(resultado).toEqual({ quantidade: 12.5, unidade: 'METRO', valorTotal: 125 });
  });

  it('nao exige comprimentoMetros cadastrado', () => {
    expect(() => calcularQuantidadePedido('RET', null, 10, 5)).not.toThrow();
  });
});

describe('calcularQuantidadePedido - KM (unidade fechada)', () => {
  it('calcula unidades fechadas corretamente quando o valor pedido fecha exato (criterio de aceite)', () => {
    const resultado = calcularQuantidadePedido('KM', 50, 20, 150);

    expect(resultado).toEqual({ quantidade: 3, unidade: 'KM', valorTotal: 3000 });
  });

  it('lanca QuantidadeNaoFechaEmUnidadeError com erro claro quando nao fecha em unidade cheia (criterio de aceite)', () => {
    expect(() => calcularQuantidadePedido('KM', 100, 20, 150)).toThrow(
      QuantidadeNaoFechaEmUnidadeError,
    );
  });

  it('tolera imprecisao de ponto flutuante numa divisao matematicamente exata', () => {
    // 0.1 + 0.2 !== 0.3 em IEEE 754 - garante que isso nao rejeita uma
    // divisao que e' exata na pratica.
    const resultado = calcularQuantidadePedido('KM', 0.1, 10, 0.3);

    expect(resultado.quantidade).toBe(3);
  });

  it('lanca ComprimentoNaoConfiguradoError quando o produto nao tem comprimentoMetros', () => {
    expect(() => calcularQuantidadePedido('KM', null, 10, 150)).toThrow(
      ComprimentoNaoConfiguradoError,
    );
  });
});

describe('calcularQuantidadePedido - tipoVenda ausente', () => {
  it('lanca TipoVendaNaoConfiguradoError quando o produto nao tem tipoVenda', () => {
    expect(() => calcularQuantidadePedido(null, 30, 10, 90)).toThrow(
      TipoVendaNaoConfiguradoError,
    );
  });
});
