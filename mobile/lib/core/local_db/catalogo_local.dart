import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'local_database.dart';

/// Cache local de listas pequenas e estáveis que o app precisa até sem rede
/// (formas/condições de pagamento da criação de pedido) - guardadas em
/// `snapshot_meta` (chave/valor, mesma tabela já usada pela config de
/// rastreio), como JSON cru da API: mesmo critério do espelho de
/// clientes/produtos (ver local_database.dart), quem lê usa o `fromJson`
/// que já existe.
class CatalogoLocal {
  CatalogoLocal(this._localDatabase);

  final LocalDatabase _localDatabase;

  static String _chave(String nome) => 'catalogo:$nome';

  Future<void> salvar(String nome, List<Map<String, dynamic>> itens) async {
    await _localDatabase.db.insert('snapshot_meta', {
      'chave': _chave(nome),
      'valor': jsonEncode(itens),
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  /// null quando nunca foi baixado neste aparelho.
  Future<List<Map<String, dynamic>>?> ler(String nome) async {
    final linhas = await _localDatabase.db.query(
      'snapshot_meta',
      where: 'chave = ?',
      whereArgs: [_chave(nome)],
    );
    if (linhas.isEmpty) return null;
    return (jsonDecode(linhas.first['valor'] as String) as List).cast<Map<String, dynamic>>();
  }

  /// Busca na rede e guarda; sem rede (ou qualquer falha), devolve o último
  /// valor guardado - só relança o erro se nunca houve um download.
  Future<List<Map<String, dynamic>>> comFallback(
    String nome,
    Future<List<Map<String, dynamic>>> Function() buscar,
  ) async {
    try {
      final itens = await buscar();
      await salvar(nome, itens);
      return itens;
    } catch (_) {
      final local = await ler(nome);
      if (local == null) rethrow;
      return local;
    }
  }
}
