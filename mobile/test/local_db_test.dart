import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:copperline_mobile/core/api_client.dart';
import 'package:copperline_mobile/core/api_exception.dart';
import 'package:copperline_mobile/core/local_db/acao_pendente.dart';
import 'package:copperline_mobile/core/local_db/dados_comerciais_service.dart';
import 'package:copperline_mobile/core/local_db/fila_pendente_service.dart';
import 'package:copperline_mobile/core/local_db/hash_acao.dart';
import 'package:copperline_mobile/core/local_db/local_database.dart';
import 'package:copperline_mobile/core/local_db/snapshot_service.dart';

// sqflite_common_ffi (OS-MOBILE-22) - roda sqlite de verdade em teste sem
// platform channel (o plugin sqflite normal so' funciona com um app
// Android/iOS rodando). Banco em memoria por teste (inMemoryDatabasePath)
// - isolado, sem limpeza manual de arquivo entre casos.
void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  tearDown(() async {
    await LocalDatabase.fecharParaTeste();
  });

  group('SnapshotService', () {
    test('baixar substitui o conteudo local pelo snapshot da API', () async {
      final db = await LocalDatabase.abrir(caminhoOverride: inMemoryDatabasePath);
      final apiClient = _ApiClientFake({
        'geradoEm': '2026-01-01T00:00:00.000Z',
        'clientes': [
          {
            'id': 'c1',
            'idExternoErp': 'ext-1',
            'cpfCnpj': null,
            'razaoSocial': 'Cliente Um',
            'nomeFantasia': null,
            'inativo': false,
          },
        ],
        'produtos': [
          {
            'id': 'p1',
            'codigo': 'COD-1',
            'nome': 'Produto Um',
            'tipo': 'PROPRIO',
            'inativo': false,
            'precoVenda': '10.5',
            'gtin': null,
          },
        ],
        'pedidos': <Map<String, dynamic>>[],
      });
      final service = SnapshotService(apiClient, db);

      await service.baixar();

      final clientes = await service.clientes();
      final produtos = await service.produtos();
      expect(clientes.map((c) => c.id), ['c1']);
      expect(produtos.map((p) => p.id), ['p1']);
      expect(await service.geradoEm(), '2026-01-01T00:00:00.000Z');
    });

    test('baixar persiste estoque e permite consulta offline por codigo (OS-BACKEND-42)', () async {
      final db = await LocalDatabase.abrir(caminhoOverride: inMemoryDatabasePath);
      final apiClient = _ApiClientFake({
        'geradoEm': '2026-01-01T00:00:00.000Z',
        'clientes': <Map<String, dynamic>>[],
        'produtos': <Map<String, dynamic>>[],
        'pedidos': <Map<String, dynamic>>[],
        'estoque': [
          {
            'produtoId': 'p1',
            'codigo': 'COD-1',
            'itens': [
              {
                'localCodigo': null,
                'localNome': null,
                'lote': null,
                'fabricadoEm': null,
                'quantidade': '42',
              },
            ],
            'atualizadoEm': '2026-01-01T00:00:00.000Z',
          },
        ],
      });
      final service = SnapshotService(apiClient, db);

      await service.baixar();

      final resultado = await service.estoquePorCodigo('COD-1');
      expect(resultado, isNotNull);
      expect(resultado!.itens.single.quantidade, '42');
      expect(await service.estoquePorCodigo('INEXISTENTE'), isNull);
    });

    test('baixar sem chave estoque no JSON (snapshot de backend antigo) nao quebra', () async {
      final db = await LocalDatabase.abrir(caminhoOverride: inMemoryDatabasePath);
      final apiClient = _ApiClientFake({
        'geradoEm': '2026-01-01T00:00:00.000Z',
        'clientes': <Map<String, dynamic>>[],
        'produtos': <Map<String, dynamic>>[],
        'pedidos': <Map<String, dynamic>>[],
      });
      final service = SnapshotService(apiClient, db);

      await service.baixar();

      expect(await service.estoquePorCodigo('QUALQUER'), isNull);
    });

    test('segunda baixa substitui a primeira (nao acumula)', () async {
      final db = await LocalDatabase.abrir(caminhoOverride: inMemoryDatabasePath);
      final service = SnapshotService(
        _ApiClientFake({
          'geradoEm': '2026-01-01T00:00:00.000Z',
          'clientes': [
            {
              'id': 'c1',
              'idExternoErp': 'ext-1',
              'cpfCnpj': null,
              'razaoSocial': 'Antigo',
              'nomeFantasia': null,
              'inativo': false,
            },
          ],
          'produtos': <Map<String, dynamic>>[],
          'pedidos': <Map<String, dynamic>>[],
        }),
        db,
      );
      await service.baixar();

      final service2 = SnapshotService(
        _ApiClientFake({
          'geradoEm': '2026-01-02T00:00:00.000Z',
          'clientes': [
            {
              'id': 'c2',
              'idExternoErp': 'ext-2',
              'cpfCnpj': null,
              'razaoSocial': 'Novo',
              'nomeFantasia': null,
              'inativo': false,
            },
          ],
          'produtos': <Map<String, dynamic>>[],
          'pedidos': <Map<String, dynamic>>[],
        }),
        db,
      );
      await service2.baixar();

      final clientes = await service2.clientes();
      expect(clientes.map((c) => c.id), ['c2']);
    });
  });

  group('DadosComerciaisService (carteira + tabelas de preco offline)', () {
    final json = {
      'geradoEm': '2026-10-01T12:00:00.000Z',
      'clientes': [
        {
          'id': 'c1',
          'idExternoErp': '17104896',
          'codigo': '10458',
          'cpfCnpj': '01.763.907/0001-75',
          'razaoSocial': 'SWAN ELETRICIDADE LTDA',
          'nomeFantasia': 'SWAN',
          'inativo': false,
          'email': null,
          'contato': null,
          'homepage': null,
          'inscricaoEstadual': '194378144',
          'enderecos': [
            {
              'tipo': 'Padrao',
              'cep': '64003-077',
              'logradouro': 'R JONATAS BATISTA',
              'numero': '2680',
              'complemento': null,
              'bairro': 'PORENQUANTO',
              'uf': 'PI',
              'email': null,
              'telefones': [
                {'ddd': '086', 'numero': '999886470'},
              ],
            },
          ],
          'contatos': [
            {
              'id': 'k1',
              'nome': 'Contato',
              'email': null,
              'telefoneDdd': '086',
              'telefoneNumero': '999886470',
              'funcao': null,
            },
          ],
        },
      ],
      'tabelasPreco': [
        {
          'codigo': '110',
          'itens': [
            ['50039', '2879.13'],
            ['99999', '10'],
          ],
        },
        {
          'codigo': '111',
          'itens': [
            ['50039', '2500'],
          ],
        },
      ],
      'tabelasPorCliente': {
        'c1': ['110', '111'],
        'c2': <String>[],
      },
    };

    Future<(DadosComerciaisService, LocalDatabase)> preparar() async {
      final db = await LocalDatabase.abrir(caminhoOverride: inMemoryDatabasePath);
      // produtos do espelho (snapshot) - so' 50039 interessa ao cliente
      await db.db.insert('produtos', {
        'id': 'p1',
        'dados':
            '{"id":"p1","codigo":"50039","nome":"CABO FLEXMEGA","tipo":null,"inativo":false,"precoVenda":null,"gtin":null}',
      });
      final service = DadosComerciaisService(_ApiClientFake(json), db);
      await service.baixar();
      return (service, db);
    }

    test('baixar guarda o detalhe do cliente e permite le-lo sem rede', () async {
      final (service, _) = await preparar();

      final cliente = await service.clienteDetalhe('c1');

      expect(cliente, isNotNull);
      expect(cliente!.codigo, '10458');
      expect(cliente.idExternoErp, '17104896');
      expect(cliente.enderecos.single.linhas.first, 'R JONATAS BATISTA, 2680');
      expect(cliente.telefones, ['(086) 999886470']);
      expect(await service.clienteDetalhe('inexistente'), isNull);
    });

    test('tabelas do cliente e preco por tabela vem do espelho local', () async {
      final (service, _) = await preparar();

      expect(await service.tabelasDoCliente('c1'), ['110', '111']);
      expect(await service.tabelasDoCliente('c2'), isEmpty);
      expect(await service.precoNaTabela('110', '50039'), '2879.13');
      expect(await service.precoNaTabela('111', '50039'), '2500');
      expect(await service.precoNaTabela('110', 'nao-existe'), isNull);
    });

    test('produtosDoCliente junta produto + preco de CADA tabela do cliente', () async {
      final (service, _) = await preparar();

      final produtos = await service.produtosDoCliente('c1');

      // 99999 tem preco na 110 mas nao existe no catalogo local -> fora
      expect(produtos, hasLength(1));
      expect(produtos.single.nome, 'CABO FLEXMEGA');
      expect(produtos.single.precosPorTabela, {'110': '2879.13', '111': '2500'});
    });

    test('tabelasDoCliente devolve null quando nada foi baixado (diferente de lista vazia)', () async {
      final db = await LocalDatabase.abrir(caminhoOverride: inMemoryDatabasePath);
      final service = DadosComerciaisService(_ApiClientFake(json), db);

      expect(await service.tabelasDoCliente('c1'), isNull);
    });
  });

  group('hashDaAcao (paridade com o servidor)', () {
    // MESMO hash de referencia de backend/src/mobile/hash-acao.spec.ts - se
    // divergir, o app nunca confirmaria nenhuma acao.
    test('hash da acao de referencia bate com o do backend', () {
      final hash = hashDaAcao(
        idLocal: '11111111-1111-4111-8111-111111111111',
        tipo: 'CRIAR_PEDIDO',
        timestamp: '2026-10-01T10:00:00.000Z',
        payload: {
          'observacoes': 'Pedido com acento: ação',
          'itens': [
            // 1000.0 (double integral) tem que canonicalizar como 1000
            {'produtoId': 'p1', 'metrosDesejados': 1000.0, 'percentualDesconto': 30.5},
          ],
        },
      );
      expect(hash, 'feb4c76764680d1ae66bc816dbedc5a39bac5bf188a5fd6cbfe962e0a33d596b');
    });
  });

  group('FilaPendenteService', () {
    test('enfileirar grava PENDENTE e listarPendentes retorna a acao', () async {
      final db = await LocalDatabase.abrir(caminhoOverride: inMemoryDatabasePath);
      final service = FilaPendenteService(_ApiClientFake({}), db);

      final idLocal = await service.enfileirar(
        tipo: TipoAcaoFila.checkinVisita,
        timestamp: DateTime.parse('2026-01-01T10:00:00.000Z'),
        payload: {'clienteId': 'c1', 'latitude': -3.7, 'longitude': -38.5},
      );

      final pendentes = await service.listarPendentes();
      expect(pendentes, hasLength(1));
      expect(pendentes.first.idLocal, idLocal);
      expect(pendentes.first.status, StatusAcaoPendente.pendente);
      expect(pendentes.first.payload['clienteId'], 'c1');
    });

    test('sincronizar marca CONFIRMADA quando o servidor responde SUCESSO', () async {
      final db = await LocalDatabase.abrir(caminhoOverride: inMemoryDatabasePath);
      final apiClient = _ApiClientPostFake();
      final service = FilaPendenteService(apiClient, db);
      final idLocal = await service.enfileirar(
        tipo: TipoAcaoFila.rastreioLote,
        timestamp: DateTime.parse('2026-01-01T10:00:00.000Z'),
        payload: {'pontos': []},
      );
      apiClient.proximaResposta = [
        {'idLocal': idLocal, 'status': 'SUCESSO'},
      ];

      await service.sincronizar();

      expect(await service.contarPendentes(), 0);
    });

    test('sincronizar marca ERRO com a mensagem do servidor quando o item falha', () async {
      final db = await LocalDatabase.abrir(caminhoOverride: inMemoryDatabasePath);
      final apiClient = _ApiClientPostFake();
      final service = FilaPendenteService(apiClient, db);
      final idLocal = await service.enfileirar(
        tipo: TipoAcaoFila.checkinVisita,
        timestamp: DateTime.parse('2026-01-01T10:00:00.000Z'),
        payload: {},
      );
      apiClient.proximaResposta = [
        {'idLocal': idLocal, 'status': 'ERRO', 'erro': 'Fora do raio maximo'},
      ];

      await service.sincronizar();

      final pendentes = await service.listarPendentes();
      expect(pendentes, hasLength(1));
      expect(pendentes.first.status, StatusAcaoPendente.erro);
      expect(pendentes.first.erro, 'Fora do raio maximo');
    });

    test('sincronizar sem rede mantem a acao PENDENTE (nao marca ERRO)', () async {
      final db = await LocalDatabase.abrir(caminhoOverride: inMemoryDatabasePath);
      final apiClient = _ApiClientPostFake()..lancarExcecao = true;
      final service = FilaPendenteService(apiClient, db);
      await service.enfileirar(
        tipo: TipoAcaoFila.rastreioLote,
        timestamp: DateTime.parse('2026-01-01T10:00:00.000Z'),
        payload: {},
      );

      await service.sincronizar();

      final pendentes = await service.listarPendentes();
      expect(pendentes.first.status, StatusAcaoPendente.pendente);
    });

    test('acao rejeitada com 413 vira ERRO mas NAO trava as demais da fila', () async {
      final db = await LocalDatabase.abrir(caminhoOverride: inMemoryDatabasePath);
      final apiClient = _ApiClientPostFake()
        ..excecoesPorChamada[1] = ApiException('request entity too large', statusCode: 413)
        ..sucessoAutomatico = true;
      final service = FilaPendenteService(apiClient, db);
      final checkin = await service.enfileirar(
        tipo: TipoAcaoFila.checkinVisita,
        timestamp: DateTime.parse('2026-01-01T10:00:00.000Z'),
        payload: {'foto': 'x'},
      );
      await service.enfileirar(
        tipo: TipoAcaoFila.criarPedido,
        timestamp: DateTime.parse('2026-01-01T10:01:00.000Z'),
        payload: {},
      );

      await service.sincronizar();

      final pendentes = await service.listarPendentes();
      expect(apiClient.chamadas, 2);
      expect(pendentes, hasLength(1));
      expect(pendentes.first.idLocal, checkin);
      expect(pendentes.first.status, StatusAcaoPendente.erro);
    });

    test('sessao expirada (401) interrompe o envio e mantem tudo PENDENTE', () async {
      final db = await LocalDatabase.abrir(caminhoOverride: inMemoryDatabasePath);
      final apiClient = _ApiClientPostFake()
        ..excecoesPorChamada[1] = ApiException('Unauthorized', statusCode: 401)
        ..sucessoAutomatico = true;
      final service = FilaPendenteService(apiClient, db);
      for (var i = 0; i < 2; i++) {
        await service.enfileirar(
          tipo: TipoAcaoFila.rastreioLote,
          timestamp: DateTime.parse('2026-01-01T10:0$i:00.000Z'),
          payload: {},
        );
      }

      await service.sincronizar();

      expect(apiClient.chamadas, 1);
      final pendentes = await service.listarPendentes();
      expect(pendentes, hasLength(2));
      expect(pendentes.every((a) => a.status == StatusAcaoPendente.pendente), isTrue);
    });

    test('SUCESSO sem ack (ou com hash diferente) NAO confirma: continua PENDENTE', () async {
      final db = await LocalDatabase.abrir(caminhoOverride: inMemoryDatabasePath);
      final apiClient = _ApiClientPostFake()..ackFalso = 'f' * 64;
      final service = FilaPendenteService(apiClient, db);
      final idLocal = await service.enfileirar(
        tipo: TipoAcaoFila.criarPedido,
        timestamp: DateTime.parse('2026-01-01T10:00:00.000Z'),
        payload: {'clienteId': 'c1'},
      );
      apiClient.proximaResposta = [
        {'idLocal': idLocal, 'status': 'SUCESSO'},
      ];

      await service.sincronizar();

      final pendentes = await service.listarPendentes();
      expect(pendentes, hasLength(1));
      expect(pendentes.first.status, StatusAcaoPendente.pendente);
    });

    test('envia o hash da acao e so confirma com o ack igual a ele', () async {
      final db = await LocalDatabase.abrir(caminhoOverride: inMemoryDatabasePath);
      final apiClient = _ApiClientPostFake();
      final service = FilaPendenteService(apiClient, db);
      final idLocal = await service.enfileirar(
        tipo: TipoAcaoFila.criarPedido,
        timestamp: DateTime.parse('2026-01-01T10:00:00.000Z'),
        payload: {'clienteId': 'c1'},
      );
      apiClient.proximaResposta = [
        {'idLocal': idLocal, 'status': 'SUCESSO'},
      ];

      await service.sincronizar();

      final enviada = (apiClient.ultimoCorpo!['acoes'] as List).single as Map<String, dynamic>;
      expect(enviada['hash'], hasLength(64));
      expect(await service.contarPendentes(), 0);
    });

    test('sincronizar sem nenhuma acao pendente nao chama a API', () async {
      final db = await LocalDatabase.abrir(caminhoOverride: inMemoryDatabasePath);
      final apiClient = _ApiClientPostFake();
      final service = FilaPendenteService(apiClient, db);

      await service.sincronizar();

      expect(apiClient.chamadas, 0);
    });
  });
}

class _ApiClientFake implements ApiJsonClient {
  _ApiClientFake(this._resposta);
  final Map<String, dynamic> _resposta;

  @override
  Future<Map<String, dynamic>> getJson(String path) async => _resposta;

  @override
  Future<List<Map<String, dynamic>>> postJsonList(String path, Map<String, dynamic> corpo) async {
    throw UnimplementedError('nao usado neste fake');
  }
}

class _ApiClientPostFake implements ApiJsonClient {
  List<Map<String, dynamic>> proximaResposta = [];
  bool lancarExcecao = false;
  // Responde SUCESSO pro idLocal enviado (1 acao por chamada) e permite
  // falhar so' numa chamada especifica (1-based) com a excecao dada.
  bool sucessoAutomatico = false;
  // Quando definido, o ack devolvido usa ESTE hash em vez de ecoar o do app
  // (simula corpo corrompido em transito / servidor com conteudo diferente).
  String? ackFalso;
  Map<String, dynamic>? ultimoCorpo;
  final Map<int, Object> excecoesPorChamada = {};
  int chamadas = 0;

  @override
  Future<Map<String, dynamic>> getJson(String path) async {
    throw UnimplementedError('nao usado neste fake');
  }

  @override
  Future<List<Map<String, dynamic>>> postJsonList(
    String path,
    Map<String, dynamic> corpo,
  ) async {
    chamadas++;
    ultimoCorpo = corpo;
    if (lancarExcecao) {
      throw Exception('Falha de rede simulada');
    }
    final excecao = excecoesPorChamada[chamadas];
    if (excecao != null) {
      throw excecao;
    }
    final acoes = (corpo['acoes'] as List).cast<Map<String, dynamic>>();
    final hashRecebido = ackFalso ?? acoes.first['hash'];
    if (sucessoAutomatico) {
      return [
        for (final acao in acoes)
          {
            'idLocal': acao['idLocal'],
            'status': 'SUCESSO',
            'ack': {'hash': acao['hash'], 'bytes': 1},
          },
      ];
    }
    // Respostas manuais de SUCESSO ganham o ack (como o servidor real faz)
    // - a menos que o teste peca um ack diferente (ackFalso).
    return [
      for (final item in proximaResposta)
        item['status'] == 'SUCESSO'
            ? {...item, 'ack': item['ack'] ?? {'hash': hashRecebido, 'bytes': 1}}
            : item,
    ];
  }
}
