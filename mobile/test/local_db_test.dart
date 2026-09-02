import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:copperline_mobile/core/api_client.dart';
import 'package:copperline_mobile/core/local_db/acao_pendente.dart';
import 'package:copperline_mobile/core/local_db/fila_pendente_service.dart';
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
    if (lancarExcecao) {
      throw Exception('Falha de rede simulada');
    }
    return proximaResposta;
  }
}
