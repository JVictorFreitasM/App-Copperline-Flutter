import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import '../api_client.dart';
import '../models/cliente.dart';
import '../models/pedido.dart';
import '../models/produto.dart';
import 'local_database.dart';

const _chaveGeradoEm = 'geradoEm';

/// Baixa GET /mobile/snapshot (OS-BACKEND-29) e repopula o espelho local
/// (OS-MOBILE-22) - substitui o conteúdo inteiro de cada tabela a cada
/// baixa (mesmo critério de ClienteSyncStrategy/etc no backend: mais
/// simples e correto do que diffar contra o estado anterior), dentro de
/// uma transação (nunca deixa o espelho pela metade se a baixa falhar no
/// meio).
class SnapshotService {
  SnapshotService(this._apiClient, this._localDatabase);

  final ApiJsonClient _apiClient;
  final LocalDatabase _localDatabase;

  Future<void> baixar() async {
    final json = await _apiClient.getJson('/mobile/snapshot');
    final db = _localDatabase.db;

    await db.transaction((tx) async {
      await tx.delete('clientes');
      await tx.delete('produtos');
      await tx.delete('pedidos');

      final batch = tx.batch();
      for (final cliente in (json['clientes'] as List).cast<Map<String, dynamic>>()) {
        batch.insert('clientes', {
          'id': cliente['id'] as String,
          'dados': jsonEncode(cliente),
        });
      }
      for (final produto in (json['produtos'] as List).cast<Map<String, dynamic>>()) {
        batch.insert('produtos', {
          'id': produto['id'] as String,
          'dados': jsonEncode(produto),
        });
      }
      for (final pedido in (json['pedidos'] as List).cast<Map<String, dynamic>>()) {
        batch.insert('pedidos', {
          'id': pedido['id'] as String,
          'dados': jsonEncode(pedido),
        });
      }
      await batch.commit(noResult: true);

      await tx.insert('snapshot_meta', {
        'chave': _chaveGeradoEm,
        'valor': json['geradoEm'] as String,
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    });
  }

  Future<String?> geradoEm() async {
    final linhas = await _localDatabase.db.query(
      'snapshot_meta',
      where: 'chave = ?',
      whereArgs: [_chaveGeradoEm],
    );
    if (linhas.isEmpty) return null;
    return linhas.first['valor'] as String;
  }

  Future<List<ClienteResumo>> clientes() async {
    final linhas = await _localDatabase.db.query('clientes');
    return linhas.map((l) => ClienteResumo.fromJson(jsonDecode(l['dados'] as String))).toList();
  }

  Future<List<ProdutoResumo>> produtos() async {
    final linhas = await _localDatabase.db.query('produtos');
    return linhas.map((l) => ProdutoResumo.fromJson(jsonDecode(l['dados'] as String))).toList();
  }

  Future<List<PedidoResumo>> pedidos() async {
    final linhas = await _localDatabase.db.query('pedidos');
    return linhas.map((l) => PedidoResumo.fromJson(jsonDecode(l['dados'] as String))).toList();
  }
}
