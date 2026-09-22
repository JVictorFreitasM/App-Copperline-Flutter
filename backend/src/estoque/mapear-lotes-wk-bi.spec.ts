import { mapearLotesWkBi, somarQuantidadeFisicaTotal } from './mapear-lotes-wk-bi';

describe('mapearLotesWkBi', () => {
  it('mapeia os campos confirmados do relatorio (nome com ponto/espaco) e converte a quantidade BR', () => {
    const itens = mapearLotesWkBi([
      {
        'Cod.': '50039',
        Produto: 'CABO FLEXMEGA',
        'Qtde Estoque': '15,4000',
        Lote: '0826-000119-3',
        'Fabricado Em': '10/08/2026',
        'Código Local': '6021',
        'Nome do Local': 'Estoque',
      },
    ]);

    expect(itens).toEqual([
      {
        lote: '0826-000119-3',
        fabricadoEm: '10/08/2026',
        localCodigo: '6021',
        localNome: 'Estoque',
        quantidade: '15.4000',
      },
    ]);
  });

  it('trata Lote e Fabricado Em vazios como null (produto sem controle de lote)', () => {
    const [item] = mapearLotesWkBi([
      {
        'Cod.': '67381',
        'Qtde Estoque': '1,0000',
        Lote: '',
        'Fabricado Em': '',
        'Código Local': '6126',
        'Nome do Local': 'Material Auxiliar',
      },
    ]);

    expect(item.lote).toBeNull();
    expect(item.fabricadoEm).toBeNull();
  });
});

describe('somarQuantidadeFisicaTotal', () => {
  it('soma a quantidade de todos os itens', () => {
    const soma = somarQuantidadeFisicaTotal([
      { lote: null, fabricadoEm: null, localCodigo: null, localNome: null, quantidade: '15.4' },
      { lote: null, fabricadoEm: null, localCodigo: null, localNome: null, quantidade: '17' },
    ]);

    expect(soma).toBe('32.4000');
  });

  it('retorna "0.0000" quando nao ha itens', () => {
    expect(somarQuantidadeFisicaTotal([])).toBe('0.0000');
  });
});
