import 'dart:convert';
import 'package:uuid/uuid.dart';
import '../api_client.dart';
import 'acao_pendente.dart';
import 'local_database.dart';

const _uuid = Uuid();

/// Fila de ações pendentes offline (OS-MOBILE-22) - `idLocal` (UUID
/// gerado no dispositivo) é a chave de idempotência que o backend usa
/// (`AcaoFilaProcessada.@@unique([usuarioId, idLocal])`, ver
/// FilaPendenteService no backend) - reenviar a mesma ação (ex: depois de
/// uma sincronização parcial) nunca duplica o efeito no servidor.
class FilaPendenteService {
  FilaPendenteService(this._apiClient, this._localDatabase);

  final ApiJsonClient _apiClient;
  final LocalDatabase _localDatabase;

  /// Chamado pelas telas que criam uma ação offline (check-in, rastreio em
  /// lote, etc - OS-MOBILE-20/21/23) - grava local e IMEDIATAMENTE
  /// PENDENTE, nunca espera a sincronização terminar pra voltar (a tela
  /// mostra "pendente de envio" - critério de aceite explícito da OS - e
  /// segue seu fluxo normal).
  Future<String> enfileirar({
    required TipoAcaoFila tipo,
    required DateTime timestamp,
    required Map<String, dynamic> payload,
  }) async {
    final idLocal = _uuid.v4();
    await _localDatabase.db.insert('acoes_pendentes', {
      'id_local': idLocal,
      'tipo': tipo.valor,
      'timestamp': timestamp.toIso8601String(),
      'payload': jsonEncode(payload),
      'status': StatusAcaoPendente.pendente.valor,
      'criado_em': DateTime.now().toIso8601String(),
    });
    return idLocal;
  }

  Future<List<AcaoPendente>> listarPendentes() async {
    final linhas = await _localDatabase.db.query(
      'acoes_pendentes',
      where: 'status IN (?, ?)',
      whereArgs: [StatusAcaoPendente.pendente.valor, StatusAcaoPendente.erro.valor],
      orderBy: 'criado_em ASC',
    );
    return linhas.map(_paraAcaoPendente).toList();
  }

  Future<int> contarPendentes() async {
    final resultado = await _localDatabase.db.rawQuery(
      'SELECT COUNT(*) as total FROM acoes_pendentes WHERE status IN (?, ?)',
      [StatusAcaoPendente.pendente.valor, StatusAcaoPendente.erro.valor],
    );
    return resultado.first['total'] as int;
  }

  /// Envia tudo que está PENDENTE/ERRO num POST só (mesmo endpoint
  /// aceita até 500 por vez, TAMANHO_MAXIMO_FILA no backend). Falha de
  /// REDE (offline de verdade) não marca nada como ERRO - as ações
  /// continuam PENDENTE pra próxima tentativa; só um ERRO reportado PELO
  /// SERVIDOR pra um item específico marca aquele item como ERRO (ver
  /// ResultadoAcaoFilaDto no backend).
  Future<void> sincronizar() async {
    final pendentes = await listarPendentes();
    if (pendentes.isEmpty) {
      return;
    }

    final List<Map<String, dynamic>> resultados;
    try {
      resultados = await _apiClient.postJsonList('/mobile/fila-pendente', {
        'acoes': pendentes
            .map(
              (a) => {
                'idLocal': a.idLocal,
                'tipo': a.tipo.valor,
                'timestamp': a.timestamp,
                'payload': a.payload,
              },
            )
            .toList(),
      });
    } catch (_) {
      // Sem conexao/erro de rede - tenta de novo na proxima chamada de
      // sincronizar() (ver offline_provider.dart, disparado ao reconectar).
      return;
    }

    final db = _localDatabase.db;
    final batch = db.batch();
    for (final item in resultados) {
      final idLocal = item['idLocal'] as String;
      final status = item['status'] as String;
      if (status == 'SUCESSO') {
        batch.update(
          'acoes_pendentes',
          {'status': StatusAcaoPendente.confirmada.valor, 'erro': null},
          where: 'id_local = ?',
          whereArgs: [idLocal],
        );
      } else {
        batch.update(
          'acoes_pendentes',
          {
            'status': StatusAcaoPendente.erro.valor,
            'erro': item['erro'] as String? ?? 'Erro desconhecido',
          },
          where: 'id_local = ?',
          whereArgs: [idLocal],
        );
      }
    }
    await batch.commit(noResult: true);
  }

  AcaoPendente _paraAcaoPendente(Map<String, dynamic> linha) {
    return AcaoPendente(
      idLocal: linha['id_local'] as String,
      tipo: TipoAcaoFila.values.firstWhere((t) => t.valor == linha['tipo']),
      timestamp: linha['timestamp'] as String,
      payload: jsonDecode(linha['payload'] as String) as Map<String, dynamic>,
      status: StatusAcaoPendenteValor.deValor(linha['status'] as String),
      erro: linha['erro'] as String?,
    );
  }
}
