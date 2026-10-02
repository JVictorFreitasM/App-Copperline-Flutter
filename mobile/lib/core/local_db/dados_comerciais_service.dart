import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import '../api_client.dart';
import '../models/cliente.dart';
import '../models/produto.dart';
import 'local_database.dart';

const _chaveGeradoEm = 'dadosComerciaisGeradoEm';
const _chavePermitirItensRepetidos = 'permitirItensRepetidos';

/// Produto com o preço dele em cada tabela do cliente (mapa tabela -> preço).
class ProdutoComPrecosDoCliente {
  const ProdutoComPrecosDoCliente({
    required this.codigo,
    required this.nome,
    required this.precosPorTabela,
  });

  final String codigo;
  final String nome;
  final Map<String, String> precosPorTabela;
}

/// Baixa GET /mobile/dados-comerciais e guarda no banco local: carteira
/// COMPLETA com detalhe (contatos, endereços...) e as tabelas de preço
/// (itens + quais tabelas são de cada cliente). É o que permite, sem rede,
/// abrir um cliente da própria carteira e ver os produtos com o preço de
/// cada tabela dele. Substitui tudo a cada baixa, dentro de uma transação
/// (nunca deixa o espelho pela metade se a baixa falhar no meio) - mesmo
/// critério de [SnapshotService].
class DadosComerciaisService {
  DadosComerciaisService(this._apiClient, this._localDatabase);

  final ApiJsonClient _apiClient;
  final LocalDatabase _localDatabase;

  Future<void> baixar() async {
    final json = await _apiClient.getJson('/mobile/dados-comerciais');
    final db = _localDatabase.db;

    await db.transaction((tx) async {
      await tx.delete('clientes_detalhe');
      await tx.delete('tabelas_preco_itens');
      await tx.delete('clientes_tabelas');

      final batch = tx.batch();
      for (final cliente in (json['clientes'] as List).cast<Map<String, dynamic>>()) {
        batch.insert('clientes_detalhe', {
          'id': cliente['id'] as String,
          'dados': jsonEncode(cliente),
        });
      }
      for (final tabela in (json['tabelasPreco'] as List).cast<Map<String, dynamic>>()) {
        final codigoTabela = tabela['codigo'] as String;
        for (final item in (tabela['itens'] as List).cast<List<dynamic>>()) {
          batch.insert('tabelas_preco_itens', {
            'tabela': codigoTabela,
            'codigo_item': item[0] as String,
            'preco': item[1] as String,
          }, conflictAlgorithm: ConflictAlgorithm.replace);
        }
      }
      final porCliente = (json['tabelasPorCliente'] as Map<String, dynamic>);
      for (final entrada in porCliente.entries) {
        for (final codigo in (entrada.value as List).cast<String>()) {
          batch.insert('clientes_tabelas', {
            'cliente_id': entrada.key,
            'codigo': codigo,
          }, conflictAlgorithm: ConflictAlgorithm.replace);
        }
      }
      await batch.commit(noResult: true);

      await tx.insert('snapshot_meta', {
        'chave': _chaveGeradoEm,
        'valor': json['geradoEm'] as String,
      }, conflictAlgorithm: ConflictAlgorithm.replace);
      await tx.insert('snapshot_meta', {
        'chave': _chavePermitirItensRepetidos,
        'valor': (json['permitirItensRepetidos'] as bool? ?? false).toString(),
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    });
  }

  /// O mesmo produto pode aparecer mais de uma vez no mesmo pedido? Vale a
  /// última config baixada (funciona offline); sem nenhuma baixada, assume o
  /// default do backend: NÃO (bloqueado).
  Future<bool> permitirItensRepetidos() async {
    final linhas = await _localDatabase.db.query(
      'snapshot_meta',
      where: 'chave = ?',
      whereArgs: [_chavePermitirItensRepetidos],
    );
    return linhas.isNotEmpty && linhas.first['valor'] == 'true';
  }

  Future<String?> geradoEm() async {
    final linhas = await _localDatabase.db.query(
      'snapshot_meta',
      where: 'chave = ?',
      whereArgs: [_chaveGeradoEm],
    );
    return linhas.isEmpty ? null : linhas.first['valor'] as String;
  }

  /// null quando o cliente não está no espelho local (fora da carteira, ou
  /// os dados comerciais nunca foram baixados neste aparelho).
  Future<ClienteDetalhe?> clienteDetalhe(String id) async {
    final linhas = await _localDatabase.db.query(
      'clientes_detalhe',
      where: 'id = ?',
      whereArgs: [id],
    );
    if (linhas.isEmpty) return null;
    return ClienteDetalhe.fromJson(jsonDecode(linhas.first['dados'] as String));
  }

  /// null = nunca baixado (diferente de lista vazia = cliente sem tabela).
  Future<List<String>?> tabelasDoCliente(String clienteId) async {
    if (await geradoEm() == null) return null;
    final linhas = await _localDatabase.db.query(
      'clientes_tabelas',
      where: 'cliente_id = ?',
      whereArgs: [clienteId],
      orderBy: 'codigo ASC',
    );
    return linhas.map((l) => l['codigo'] as String).toList();
  }

  Future<String?> precoNaTabela(String codigoTabela, String codigoProduto) async {
    final linhas = await _localDatabase.db.query(
      'tabelas_preco_itens',
      columns: ['preco'],
      where: 'tabela = ? AND codigo_item = ?',
      whereArgs: [codigoTabela, codigoProduto],
    );
    return linhas.isEmpty ? null : linhas.first['preco'] as String;
  }

  /// Produtos que têm preço em alguma tabela do cliente, com o preço de
  /// cada tabela - ordenado por nome. Vazio se o cliente não tem tabela.
  Future<List<ProdutoComPrecosDoCliente>> produtosDoCliente(String clienteId) async {
    final tabelas = await tabelasDoCliente(clienteId) ?? const <String>[];
    if (tabelas.isEmpty) return const [];

    final marcadores = List.filled(tabelas.length, '?').join(',');
    final itens = await _localDatabase.db.rawQuery(
      'SELECT tabela, codigo_item, preco FROM tabelas_preco_itens WHERE tabela IN ($marcadores)',
      tabelas,
    );
    final precosPorProduto = <String, Map<String, String>>{};
    for (final item in itens) {
      (precosPorProduto[item['codigo_item'] as String] ??= {})[item['tabela'] as String] =
          item['preco'] as String;
    }

    final linhasProdutos = await _localDatabase.db.query('produtos');
    final resultado = <ProdutoComPrecosDoCliente>[];
    for (final linha in linhasProdutos) {
      final produto = ProdutoResumo.fromJson(jsonDecode(linha['dados'] as String));
      final codigo = produto.codigo;
      final precos = codigo == null ? null : precosPorProduto[codigo];
      if (codigo == null || precos == null) continue;
      resultado.add(
        ProdutoComPrecosDoCliente(codigo: codigo, nome: produto.titulo, precosPorTabela: precos),
      );
    }
    resultado.sort((a, b) => a.nome.toLowerCase().compareTo(b.nome.toLowerCase()));
    return resultado;
  }
}
