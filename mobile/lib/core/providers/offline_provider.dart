import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../local_db/fila_pendente_service.dart';
import '../local_db/local_database.dart';
import '../local_db/snapshot_service.dart';

/// Infraestrutura offline (OS-MOBILE-22) - banco local (abertura é
/// assíncrona, por isso FutureProvider) + os dois serviços que operam
/// sobre ele.
final localDatabaseProvider = FutureProvider<LocalDatabase>((ref) => LocalDatabase.abrir());

final snapshotServiceProvider = FutureProvider<SnapshotService>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final db = await ref.watch(localDatabaseProvider.future);
  return SnapshotService(apiClient, db);
});

final filaPendenteServiceProvider = FutureProvider<FilaPendenteService>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final db = await ref.watch(localDatabaseProvider.future);
  return FilaPendenteService(apiClient, db);
});

/// Quantidade de ações offline aguardando envio (PENDENTE/ERRO) - usado
/// pro indicador visual de "pendente de envio" (critério de aceite
/// explícito da OS). `autoDispose` + `ref.invalidateSelf()` seria mais
/// "correto" pra atualizar sozinho a cada mudança, mas a fila só muda por
/// ação do próprio app (enfileirar/sincronizar) - cada call site já
/// invalida este provider depois de mexer na fila (ver
/// OfflineSyncNotifier abaixo).
final contagemPendentesProvider = FutureProvider<int>((ref) async {
  final fila = await ref.watch(filaPendenteServiceProvider.future);
  return fila.contarPendentes();
});

/// Dispara sincronização da fila sempre que a conectividade muda de "sem
/// rede nenhuma" pra "tem alguma rede" (wifi OU dados móveis - critério de
/// aceite explícito: "não restringir a wifi"). `connectivity_plus` só diz
/// que HÁ uma interface de rede, não que ela tem internet de verdade -
/// falha real de envio (ainda sem internet apesar da interface up) é
/// tratada dentro de FilaPendenteService.sincronizar (não marca erro,
/// tenta de novo na próxima mudança de conectividade).
class OfflineSyncNotifier {
  OfflineSyncNotifier(this._ref) {
    _assinatura = Connectivity().onConnectivityChanged.listen(_aoMudarConectividade);
    // OS-MOBILE-36: a transição de conectividade sozinha não cobre o caso
    // "rádio conectado mas sem internet de verdade" (wifi cativo, sem
    // sinal real) - o ConnectivityResult fica "wifi" o tempo todo, sem
    // nunca disparar uma nova transição pra reprocessar a fila quando a
    // internet volta de fato. Esse timer é o fallback: reforça a
    // sincronização periodicamente enquanto houver algo pendente, sem
    // depender de uma mudança de estado do rádio acontecer.
    _timerRetentativa = Timer.periodic(const Duration(seconds: 45), (_) => _retentarSePendente());
  }

  final Ref _ref;
  StreamSubscription<List<ConnectivityResult>>? _assinatura;
  Timer? _timerRetentativa;
  bool _semRedeAnteriormente = false;

  void _aoMudarConectividade(List<ConnectivityResult> resultados) {
    final semRede = resultados.every((r) => r == ConnectivityResult.none);
    if (_semRedeAnteriormente && !semRede) {
      sincronizarAgora();
    }
    _semRedeAnteriormente = semRede;
  }

  Future<void> _retentarSePendente() async {
    final fila = await _ref.read(filaPendenteServiceProvider.future);
    if (await fila.contarPendentes() > 0) {
      await sincronizarAgora();
    }
  }

  Future<void> sincronizarAgora() async {
    final fila = await _ref.read(filaPendenteServiceProvider.future);
    await fila.sincronizar();
    _ref.invalidate(contagemPendentesProvider);
  }

  void dispose() {
    _assinatura?.cancel();
    _timerRetentativa?.cancel();
  }
}

final offlineSyncNotifierProvider = Provider<OfflineSyncNotifier>((ref) {
  final notifier = OfflineSyncNotifier(ref);
  ref.onDispose(notifier.dispose);
  return notifier;
});
