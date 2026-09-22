import { buildSaldoEstoqueLotesConfig } from './build-saldo-estoque-lotes-config';

describe('buildSaldoEstoqueLotesConfig', () => {
  it('inclui Empresa e o codigo do produto informados', () => {
    const config = buildSaldoEstoqueLotesConfig({
      empresa: 'teste',
      codigoProduto: '50039',
    });

    expect(config).toContain('"Empresa"="teste";');
    expect(config).toContain('"CodProdutos"="50039";');
    expect(config).toContain('"Modelo"="Saldo de Produtos por Local de Estocagem - BOT";');
    expect(config).toContain('"Relatorio"="GerencialSaldoEstoque";');
  });

  // Confirmado via teste real (2026-09-22) que um Hash antigo/invalido
  // QUEBRA a chamada (erro 2273) - nunca reintroduzir esse campo sem uma
  // razao concreta e testada de novo.
  it('nunca inclui o campo Hash', () => {
    const config = buildSaldoEstoqueLotesConfig({
      empresa: 'teste',
      codigoProduto: '50039',
    });

    expect(config).not.toContain('"Hash"');
  });
});
