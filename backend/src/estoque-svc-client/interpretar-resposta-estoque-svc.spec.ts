import {
  encontrarFault,
  encontrarItensSaldo,
} from './interpretar-resposta-estoque-svc';

describe('encontrarItensSaldo', () => {
  it('encontra um unico item (fast-xml-parser retorna objeto, nao array, quando ha so 1)', () => {
    const documento = {
      Envelope: {
        Body: {
          BuscarSaldoProdutoResponse: {
            BuscarSaldoProdutoResult: {
              QuantidadeDisponivelProduto: {
                CodigoProduto: '50010',
                QuantidadeDisponivel: '14,5830',
              },
            },
          },
        },
      },
    };

    const itens = encontrarItensSaldo(documento);

    expect(itens).toHaveLength(1);
    expect(itens[0]['CodigoProduto']).toBe('50010');
  });

  it('encontra multiplos itens (fast-xml-parser retorna array quando ha mais de 1)', () => {
    const documento = {
      Envelope: {
        Body: {
          BuscarSaldoProdutoResponse: {
            BuscarSaldoProdutoResult: {
              QuantidadeDisponivelProduto: [
                { CodigoProduto: '1', QuantidadeDisponivel: '10' },
                { CodigoProduto: '2', QuantidadeDisponivel: '20' },
              ],
            },
          },
        },
      },
    };

    const itens = encontrarItensSaldo(documento);

    expect(itens).toHaveLength(2);
    expect(itens.map((i) => i['CodigoProduto'])).toEqual(['1', '2']);
  });

  it('retorna lista vazia quando nao ha nenhum item', () => {
    const documento = {
      Envelope: { Body: { BuscarSaldoProdutoResponse: {} } },
    };

    expect(encontrarItensSaldo(documento)).toEqual([]);
  });
});

describe('encontrarFault', () => {
  it('detecta um RadarWebDotNetWCFFaultFault dentro de Body.Fault.detail', () => {
    const documento = {
      Envelope: {
        Body: {
          Fault: {
            faultcode: 'Client',
            faultstring: 'erro generico',
            detail: {
              RadarWebDotNetWCFFaultFault: {
                Funcao: 'BuscarSaldoProduto',
                IdMensagem: '42',
                Mensagem: 'Nenhum tipo de estoque selecionado no filtro',
              },
            },
          },
        },
      },
    };

    const fault = encontrarFault(documento);

    expect(fault).toEqual({
      funcao: 'BuscarSaldoProduto',
      idMensagem: '42',
      mensagem: 'Nenhum tipo de estoque selecionado no filtro',
    });
  });

  it('retorna null quando a resposta e um sucesso normal, sem fault', () => {
    const documento = {
      Envelope: {
        Body: {
          BuscarSaldoProdutoResponse: {
            BuscarSaldoProdutoResult: {
              QuantidadeDisponivelProduto: {
                CodigoProduto: '1',
                QuantidadeDisponivel: '10',
              },
            },
          },
        },
      },
    };

    expect(encontrarFault(documento)).toBeNull();
  });
});
