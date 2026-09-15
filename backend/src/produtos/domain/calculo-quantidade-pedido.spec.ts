import { calcularQuantidadePedido, QuantidadeNaoFechaEmUnidadeError } from './calculo-quantidade-pedido';

// OS-novas-implementacoes.md Bloco 4 (revisao) - a regra passou a ser
// dirigida pelo tamanhoPadrao do TipoAcondicionamento, nao mais por
// Produto.tipoVenda (POC/RET/KM), que nunca era preenchido na pratica.
describe('calcularQuantidadePedido - tamanho fixo (multiplo/unidade)', () => {
  it('tamanhoPadrao=30 com pedido de 90m calcula 3 pecas corretamente (criterio de aceite)', () => {
    const resultado = calcularQuantidadePedido(30, 10, 90);

    expect(resultado).toEqual({ quantidade: 3, unidade: 'PECA', valorTotal: 900 });
  });

  it('lanca QuantidadeNaoFechaEmUnidadeError quando nao divide exatamente', () => {
    // 100 / 30 = 3.33 -> nao fecha em peca cheia, bloqueia
    expect(() => calcularQuantidadePedido(30, 10, 100)).toThrow(QuantidadeNaoFechaEmUnidadeError);
  });

  it('mensagem de erro informa o multiplo mais proximo pro vendedor corrigir', () => {
    expect(() => calcularQuantidadePedido(30, 10, 100)).toThrow(/90m/);
  });

  it('bloqueia pedido bem menor que o tamanhoPadrao (nao arredonda pra 1 peca)', () => {
    expect(() => calcularQuantidadePedido(30, 10, 2)).toThrow(QuantidadeNaoFechaEmUnidadeError);
  });

  it('tolera imprecisao de ponto flutuante numa divisao matematicamente exata', () => {
    // 0.1 + 0.2 !== 0.3 em IEEE 754 - garante que isso nao rejeita uma
    // divisao que e' exata na pratica.
    const resultado = calcularQuantidadePedido(0.1, 10, 0.3);

    expect(resultado.quantidade).toBe(3);
  });

  it("tamanhoPadrao=1 ('unidade') exige numero inteiro de pecas", () => {
    expect(() => calcularQuantidadePedido(1, 10, 2.5)).toThrow(QuantidadeNaoFechaEmUnidadeError);

    const resultado = calcularQuantidadePedido(1, 10, 3);
    expect(resultado).toEqual({ quantidade: 3, unidade: 'PECA', valorTotal: 30 });
  });
});

describe('calcularQuantidadePedido - retalho (tamanhoPadrao null)', () => {
  it('aceita valor fracionario sem erro (criterio de aceite)', () => {
    const resultado = calcularQuantidadePedido(null, 10, 12.5);

    expect(resultado).toEqual({ quantidade: 12.5, unidade: 'METRO', valorTotal: 125 });
  });

  it('nao exige nenhum tamanho cadastrado', () => {
    expect(() => calcularQuantidadePedido(null, 10, 5)).not.toThrow();
  });
});
