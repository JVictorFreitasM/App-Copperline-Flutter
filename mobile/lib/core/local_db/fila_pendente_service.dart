import 'dart:convert';
import 'package:uuid/uuid.dart';
import '../api_client.dart';
import '../api_exception.dart';
import 'acao_pendente.dart';
import 'hash_acao.dart';
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

  // Envio em andamento NESTE isolate - sincronizar() chamado de novo (outro
  // gatilho: conexão que voltou, timer, botão) reaproveita este mesmo envio
  // em vez de começar outro em paralelo. static porque mais de uma instância
  // do serviço pode existir no mesmo isolate.
  static Future<void>? _envioEmAndamento;

  // Reivindicação de uma ação em ENVIANDO mais velha que isso é considerada
  // abandonada (app morto no meio do envio) e pode ser retomada.
  static const _validadeReivindicacao = Duration(minutes: 2);

  /// Chamado pelas telas que criam uma ação offline (check-in, rastreio em
  /// lote, etc - OS-MOBILE-20/21/23) - grava local e IMEDIATAMENTE
  /// PENDENTE, nunca espera a sincronização terminar pra voltar (a tela
  /// mostra "pendente de envio" - critério de aceite explícito da OS - e
  /// segue seu fluxo normal).
  ///
  /// [idLocal] opcional: o pedido que já foi enviado direto (e cujo envio
  /// deu timeout) entra na fila com o MESMO id, pra o servidor reconhecer que
  /// é o mesmo pedido e não criar outro.
  Future<String> enfileirar({
    required TipoAcaoFila tipo,
    required DateTime timestamp,
    required Map<String, dynamic> payload,
    String? idLocal,
  }) async {
    idLocal ??= _uuid.v4();
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
      where: 'status IN (?, ?, ?)',
      whereArgs: [
        StatusAcaoPendente.pendente.valor,
        StatusAcaoPendente.erro.valor,
        StatusAcaoPendente.enviando.valor,
      ],
      orderBy: 'criado_em ASC',
    );
    return linhas.map(_paraAcaoPendente).toList();
  }

  Future<int> contarPendentes() async {
    final resultado = await _localDatabase.db.rawQuery(
      'SELECT COUNT(*) as total FROM acoes_pendentes WHERE status IN (?, ?, ?)',
      [
        StatusAcaoPendente.pendente.valor,
        StatusAcaoPendente.erro.valor,
        StatusAcaoPendente.enviando.valor,
      ],
    );
    return resultado.first['total'] as int;
  }

  /// Envia as ações PENDENTE/ERRO em ordem, UMA POR REQUISIÇÃO (o endpoint
  /// aceita lote, mas um lote único trava tudo por causa de uma ação ruim -
  /// ex: check-in com foto grande rejeitado com 413 bloqueava pedidos e
  /// rastreio que estavam atrás dele na fila). Por ação:
  /// - rede caiu (sem resposta) ou sessão expirada (401/403): para aqui e
  ///   mantém tudo PENDENTE (volta a tentar na próxima chamada; sessão
  ///   expirada se resolve ao logar de novo, nada se perde);
  /// - servidor respondeu SUCESSO: CONFIRMADA;
  /// - servidor respondeu ERRO pro item, ou rejeitou a requisição (413,
  ///   422...): marca ERRO com a mensagem (visível pro usuário) e segue
  ///   pras próximas - uma ação ruim não bloqueia as outras.
  Future<void> sincronizar() {
    final emAndamento = _envioEmAndamento;
    if (emAndamento != null) {
      return emAndamento;
    }
    final envio = _enviarPendentes().whenComplete(() => _envioEmAndamento = null);
    _envioEmAndamento = envio;
    return envio;
  }

  /// Pega a ação pra este envio (PENDENTE/ERRO -> ENVIANDO) num UPDATE
  /// atômico - vale também entre isolates (WorkManager em segundo plano x app
  /// aberto), que não enxergam a trava em memória. Devolve false se outro
  /// envio já está com ela.
  Future<bool> _reivindicar(String idLocal) async {
    final limite = DateTime.now().subtract(_validadeReivindicacao).toIso8601String();
    final linhas = await _localDatabase.db.rawUpdate(
      'UPDATE acoes_pendentes SET status = ?, enviando_em = ? '
      'WHERE id_local = ? AND (status IN (?, ?) OR (status = ? AND enviando_em < ?))',
      [
        StatusAcaoPendente.enviando.valor,
        DateTime.now().toIso8601String(),
        idLocal,
        StatusAcaoPendente.pendente.valor,
        StatusAcaoPendente.erro.valor,
        StatusAcaoPendente.enviando.valor,
        limite,
      ],
    );
    return linhas == 1;
  }

  /// Devolve a ação ao estado que tinha antes da reivindicação (não entregue:
  /// rede caiu, sem ack, servidor ainda processando).
  Future<void> _liberar(String idLocal, StatusAcaoPendente statusAnterior) async {
    await _localDatabase.db.update(
      'acoes_pendentes',
      {'status': statusAnterior.valor, 'enviando_em': null},
      where: 'id_local = ? AND status = ?',
      whereArgs: [idLocal, StatusAcaoPendente.enviando.valor],
    );
  }

  Future<void> _enviarPendentes() async {
    final pendentes = await listarPendentes();

    for (final acao in pendentes) {
      // Ação que estava ENVIANDO abandonada volta como PENDENTE se não der.
      final statusAnterior = acao.status == StatusAcaoPendente.erro
          ? StatusAcaoPendente.erro
          : StatusAcaoPendente.pendente;
      if (!await _reivindicar(acao.idLocal)) {
        // Outro envio (outro isolate) está com esta ação.
        continue;
      }
      var finalizada = false;
      try {
        // Hash do que ESTE aparelho está enviando - o servidor recalcula sobre
        // o que recebeu e devolve no ack; só o ack igual a este hash confirma
        // a ação (à prova de corpo truncado/corrompido e de resposta perdida).
        final hashEnviado = hashDaAcao(
          idLocal: acao.idLocal,
          tipo: acao.tipo.valor,
          timestamp: acao.timestamp,
          payload: acao.payload,
        );
        final List<Map<String, dynamic>> resultados;
        try {
          resultados = await _apiClient.postJsonList('/mobile/fila-pendente', {
            'acoes': [
              {
                'idLocal': acao.idLocal,
                'tipo': acao.tipo.valor,
                'timestamp': acao.timestamp,
                'payload': acao.payload,
                'hash': hashEnviado,
              },
            ],
          });
        } on ApiException catch (erro) {
          final semResposta = erro.statusCode == null;
          final sessaoInvalida = erro.statusCode == 401 || erro.statusCode == 403;
          if (semResposta || sessaoInvalida) {
            return;
          }
          // Servidor respondeu e rejeitou ESTA ação (ex: 413 payload grande,
          // 4xx/5xx) - não adianta repetir igual, mas não pode travar o resto.
          await _marcarErro(acao.idLocal, erro.message);
          finalizada = true;
          continue;
        } catch (_) {
          // Falha inesperada de transporte - trata como rede.
          return;
        }

        for (final item in resultados) {
          if (item['idLocal'] != acao.idLocal) continue;
          if (item['status'] == 'SUCESSO') {
            // Sem ack válido a ação NÃO é dada como entregue: continua PENDENTE
            // e o próximo reenvio devolve o resultado já gravado (mesmo idLocal
            // nunca duplica no servidor).
            final ack = item['ack'];
            final hashRecebido = ack is Map ? ack['hash'] : null;
            if (hashRecebido != hashEnviado) {
              continue;
            }
            await _localDatabase.db.update(
              'acoes_pendentes',
              {
                'status': StatusAcaoPendente.confirmada.valor,
                'erro': null,
                'enviando_em': null,
              },
              where: 'id_local = ?',
              whereArgs: [acao.idLocal],
            );
            finalizada = true;
          } else if (item['status'] == 'PROCESSANDO') {
            // O servidor ainda está executando esta MESMA ação (outra
            // requisição) - não é erro: fica pendente e o próximo envio recebe
            // o resultado já gravado.
            continue;
          } else {
            await _marcarErro(acao.idLocal, item['erro'] as String? ?? 'Erro desconhecido');
            finalizada = true;
          }
        }
      } finally {
        if (!finalizada) {
          await _liberar(acao.idLocal, statusAnterior);
        }
      }
    }
  }

  Future<void> _marcarErro(String idLocal, String mensagem) async {
    await _localDatabase.db.update(
      'acoes_pendentes',
      {'status': StatusAcaoPendente.erro.valor, 'erro': mensagem, 'enviando_em': null},
      where: 'id_local = ?',
      whereArgs: [idLocal],
    );
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
