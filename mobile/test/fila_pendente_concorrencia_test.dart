import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:copperline_mobile/core/api_client.dart';
import 'package:copperline_mobile/core/local_db/acao_pendente.dart';
import 'package:copperline_mobile/core/local_db/fila_pendente_service.dart';
import 'package:copperline_mobile/core/local_db/hash_acao.dart';
import 'package:copperline_mobile/core/local_db/local_database.dart';

// Fake que SEGURA a resposta até o teste liberar - simula um envio lento pra
// provocar sincronizações concorrentes da mesma ação (causa dos pedidos
// duplicados/triplicados).
class _ApiClientLento implements ApiJsonClient {
  final List<Map<String, dynamic>> corposRecebidos = [];
  final _liberacao = Completer<void>();
  String statusDaResposta = 'SUCESSO';

  void liberar() => _liberacao.complete();

  @override
  Future<Map<String, dynamic>> getJson(String path) async => {};

  @override
  Future<List<Map<String, dynamic>>> postJsonList(String path, Map<String, dynamic> corpo) async {
    final acao = (corpo['acoes'] as List).first as Map<String, dynamic>;
    corposRecebidos.add(acao);
    await _liberacao.future;
    return [
      {
        'idLocal': acao['idLocal'],
        'status': statusDaResposta,
        'ack': {'hash': acao['hash'], 'bytes': 0},
      },
    ];
  }
}

Future<(FilaPendenteService, LocalDatabase)> _preparar(ApiJsonClient api) async {
  final db = await LocalDatabase.abrir(caminhoOverride: inMemoryDatabasePath);
  return (FilaPendenteService(api, db), db);
}

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  tearDown(() async {
    await LocalDatabase.fecharParaTeste();
  });

  test('sincronizar chamado varias vezes ao mesmo tempo envia a acao UMA vez so', () async {
    final api = _ApiClientLento();
    final (service, _) = await _preparar(api);
    await service.enfileirar(
      tipo: TipoAcaoFila.criarPedido,
      timestamp: DateTime.parse('2026-01-01T10:00:00.000Z'),
      payload: {'clienteId': 'c1'},
    );

    // Tres gatilhos quase simultaneos (conexao voltou, timer, botao).
    final envios = [service.sincronizar(), service.sincronizar(), service.sincronizar()];
    await Future<void>.delayed(const Duration(milliseconds: 50));
    api.liberar();
    await Future.wait(envios);

    expect(api.corposRecebidos, hasLength(1));
    expect(await service.contarPendentes(), 0);
  });

  test('outro envio (outro isolate) ja com a acao reivindicada: nao reenvia', () async {
    final api = _ApiClientLento();
    final (service, db) = await _preparar(api);
    final idLocal = await service.enfileirar(
      tipo: TipoAcaoFila.criarPedido,
      timestamp: DateTime.parse('2026-01-01T10:00:00.000Z'),
      payload: {'clienteId': 'c1'},
    );
    // Simula o WorkManager em segundo plano com a acao em ENVIANDO agora.
    await db.db.update(
      'acoes_pendentes',
      {
        'status': StatusAcaoPendente.enviando.valor,
        'enviando_em': DateTime.now().toIso8601String(),
      },
      where: 'id_local = ?',
      whereArgs: [idLocal],
    );

    api.liberar();
    await service.sincronizar();

    expect(api.corposRecebidos, isEmpty);
    final pendentes = await service.listarPendentes();
    expect(pendentes.single.status, StatusAcaoPendente.enviando);
  });

  test('reivindicacao abandonada (ENVIANDO antiga, app morto) e retomada', () async {
    final api = _ApiClientLento();
    final (service, db) = await _preparar(api);
    final idLocal = await service.enfileirar(
      tipo: TipoAcaoFila.criarPedido,
      timestamp: DateTime.parse('2026-01-01T10:00:00.000Z'),
      payload: {'clienteId': 'c1'},
    );
    await db.db.update(
      'acoes_pendentes',
      {
        'status': StatusAcaoPendente.enviando.valor,
        'enviando_em': DateTime.now().subtract(const Duration(minutes: 10)).toIso8601String(),
      },
      where: 'id_local = ?',
      whereArgs: [idLocal],
    );

    api.liberar();
    await service.sincronizar();

    expect(api.corposRecebidos, hasLength(1));
    expect(await service.contarPendentes(), 0);
  });

  test('servidor respondeu PROCESSANDO: acao volta a PENDENTE, sem virar ERRO', () async {
    final api = _ApiClientLento()..statusDaResposta = 'PROCESSANDO';
    final (service, _) = await _preparar(api);
    await service.enfileirar(
      tipo: TipoAcaoFila.criarPedido,
      timestamp: DateTime.parse('2026-01-01T10:00:00.000Z'),
      payload: {'clienteId': 'c1'},
    );

    api.liberar();
    await service.sincronizar();

    final pendentes = await service.listarPendentes();
    expect(pendentes.single.status, StatusAcaoPendente.pendente);
    expect(pendentes.single.erro, isNull);
  });

  test('enfileirar com idLocal informado usa o MESMO id (pedido que deu timeout no envio direto)', () async {
    final api = _ApiClientLento();
    final (service, _) = await _preparar(api);

    final idLocal = await service.enfileirar(
      idLocal: '11111111-1111-4111-8111-111111111111',
      tipo: TipoAcaoFila.criarPedido,
      timestamp: DateTime.parse('2026-01-01T10:00:00.000Z'),
      payload: {'clienteId': 'c1'},
    );

    expect(idLocal, '11111111-1111-4111-8111-111111111111');
    api.liberar();
    await service.sincronizar();
    expect(api.corposRecebidos.single['idLocal'], '11111111-1111-4111-8111-111111111111');
    expect(
      api.corposRecebidos.single['hash'],
      hashDaAcao(
        idLocal: idLocal,
        tipo: 'CRIAR_PEDIDO',
        timestamp: '2026-01-01T10:00:00.000Z',
        payload: {'clienteId': 'c1'},
      ),
    );
  });
}
