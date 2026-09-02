import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

/// Banco local completo (OS-MOBILE-22) - espelha clientes/produtos/pedidos
/// do vendedor logado (via GET /mobile/snapshot, ver snapshot_service.dart)
/// e guarda a fila de ações pendentes offline (ver fila_pendente_service.dart).
///
/// Cada tabela de "espelho" (clientes/produtos/pedidos) guarda o JSON bruto
/// da API numa coluna só (`dados`), indexado por `id` - mais simples e
/// resiliente a mudança de shape do DTO do que uma coluna por campo; quem
/// lê de volta usa o mesmo `fromJson` que já existe pros modelos (ver
/// snapshot_service.dart). Isso é deliberadamente diferente de `drift`
/// (schema tipado com codegen) - dado espelhado aqui é só pra leitura
/// offline, nunca editado localmente linha a linha, então o ganho de um
/// schema tipado não compensa a complexidade extra de build_runner.
class LocalDatabase {
  LocalDatabase._(this._db);

  final Database _db;

  static LocalDatabase? _instancia;

  // caminhoOverride: so' pra teste (ex: inMemoryDatabasePath, sqflite) -
  // isola cada teste num banco proprio em vez de reusar o arquivo real do
  // dispositivo.
  static Future<LocalDatabase> abrir({String? caminhoOverride}) async {
    if (_instancia != null) {
      return _instancia!;
    }
    final caminho = caminhoOverride ?? join(await getDatabasesPath(), 'copperline_offline.db');
    final db = await openDatabase(
      caminho,
      version: 2,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE clientes (id TEXT PRIMARY KEY, dados TEXT NOT NULL)
        ''');
        await db.execute('''
          CREATE TABLE produtos (id TEXT PRIMARY KEY, dados TEXT NOT NULL)
        ''');
        await db.execute('''
          CREATE TABLE pedidos (id TEXT PRIMARY KEY, dados TEXT NOT NULL)
        ''');
        // codigo do produto como chave (mesma chave de EstoqueConsultaDto
        // no backend, ver mobile-snapshot.service.ts) - consulta offline
        // de estoque (gap encontrado na auditoria da OS-BACKEND-42).
        await db.execute('''
          CREATE TABLE estoque (codigo TEXT PRIMARY KEY, dados TEXT NOT NULL)
        ''');
        await db.execute('''
          CREATE TABLE snapshot_meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)
        ''');
        await db.execute('''
          CREATE TABLE acoes_pendentes (
            id_local TEXT PRIMARY KEY,
            tipo TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            payload TEXT NOT NULL,
            status TEXT NOT NULL,
            resultado TEXT,
            erro TEXT,
            criado_em TEXT NOT NULL
          )
        ''');
      },
      // Instalação existente (banco já criado na v1, sem a tabela
      // `estoque`) - onCreate não roda de novo, só onUpgrade (dispositivo
      // que já tinha o app antes desta OS).
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          await db.execute('''
            CREATE TABLE IF NOT EXISTS estoque (codigo TEXT PRIMARY KEY, dados TEXT NOT NULL)
          ''');
        }
      },
    );
    _instancia = LocalDatabase._(db);
    return _instancia!;
  }

  Database get db => _db;

  // So pra teste - fecha a conexao de verdade (nao so' zera a referencia
  // local): sqflite mantem um cache proprio por caminho, entao reabrir o
  // MESMO inMemoryDatabasePath sem fechar a conexao anterior devolveria a
  // mesma base "suja" do teste anterior em vez de uma nova vazia (ver
  // local_db_test.dart).
  static Future<void> fecharParaTeste() async {
    await _instancia?._db.close();
    _instancia = null;
  }
}
