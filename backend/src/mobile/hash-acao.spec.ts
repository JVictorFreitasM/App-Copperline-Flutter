import { comprovanteDaAcao, jsonCanonico } from './hash-acao';

describe('jsonCanonico', () => {
  it('ordena chaves recursivamente e ignora a ordem de entrada', () => {
    expect(jsonCanonico({ b: 1, a: { d: [2, 1], c: 'x' } })).toBe(
      '{"a":{"c":"x","d":[2,1]},"b":1}',
    );
  });

  it('inteiro e decimal "inteiro" ficam iguais (30 e 30.0 chegam como 30)', () => {
    expect(jsonCanonico({ n: 30 })).toBe('{"n":30}');
  });
});

describe('comprovanteDaAcao', () => {
  const acao = {
    idLocal: '11111111-1111-4111-8111-111111111111',
    tipo: 'CRIAR_PEDIDO',
    timestamp: '2026-10-01T10:00:00.000Z',
    payload: {
      observacoes: 'Pedido com acento: ação',
      itens: [{ produtoId: 'p1', metrosDesejados: 1000, percentualDesconto: 30.5 }],
    },
  };

  it('hash e estavel e independente da ordem das chaves', () => {
    const reordenada = {
      payload: {
        itens: [{ percentualDesconto: 30.5, metrosDesejados: 1000, produtoId: 'p1' }],
        observacoes: 'Pedido com acento: ação',
      },
      timestamp: acao.timestamp,
      tipo: acao.tipo,
      idLocal: acao.idLocal,
    };
    expect(comprovanteDaAcao(reordenada)).toEqual(comprovanteDaAcao(acao));
  });

  it('qualquer alteracao no conteudo muda o hash', () => {
    const alterada = { ...acao, payload: { ...acao.payload, observacoes: 'outra' } };
    expect(comprovanteDaAcao(alterada).hash).not.toBe(comprovanteDaAcao(acao).hash);
  });

  // MESMO valor esperado no teste do app (hash_acao_test.dart) - se os dois
  // lados divergirem, o app nunca confirmaria nenhuma acao.
  it('paridade com o app: hash fixo da acao de referencia', () => {
    expect(comprovanteDaAcao(acao).hash).toBe(HASH_REFERENCIA);
  });
});

const HASH_REFERENCIA = 'feb4c76764680d1ae66bc816dbedc5a39bac5bf188a5fd6cbfe962e0a33d596b';
