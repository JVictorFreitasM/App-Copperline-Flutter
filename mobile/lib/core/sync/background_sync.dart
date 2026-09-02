import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:workmanager/workmanager.dart';
import '../api_client.dart';
import '../auth/session_storage.dart';
import '../local_db/fila_pendente_service.dart';
import '../local_db/local_database.dart';

const nomeTarefaSincronizacaoFila = 'sincronizacao-fila-pendente';

// Intervalo mínimo que o Android WorkManager aceita pra trabalho periódico
// (imposição da plataforma, não escolha do projeto - pedir menos que isso
// é silenciosamente arredondado pra 15min pelo próprio Android).
const _intervaloMinimoAndroid = Duration(minutes: 15);

// Callback dispatcher (OS-MOBILE-39) roda numa isolate headless própria,
// SEM acesso ao ProviderContainer do app principal - monta as dependências
// direto (mesmas classes usadas pelo app normal, só sem Riverpod nesta
// isolate). Só Android (decisão confirmada com o usuário - "esse app não
// tem versão pra iOS"), por isso não há preocupação com BGTaskScheduler.
@pragma('vm:entry-point')
void callbackDispatcherSincronizacao() {
  Workmanager().executeTask((tarefa, _) async {
    if (tarefa != nomeTarefaSincronizacaoFila) {
      return true;
    }

    final sessionStorage = const SessionStorage(FlutterSecureStorage());
    final cookie = await sessionStorage.lerCookie();
    if (cookie == null) {
      // Sem sessão salva (nunca logou, ou deslogou) - nada pra sincronizar,
      // não é falha.
      return true;
    }

    final apiClient = ApiClient(sessionStorage);
    final localDatabase = await LocalDatabase.abrir();
    final filaService = FilaPendenteService(apiClient, localDatabase);
    // sincronizar() já trata falha de rede internamente (mantém PENDENTE,
    // nunca lança - ver fila_pendente_service.dart) - sempre retorna
    // sucesso pro WorkManager, o retry de verdade é o próximo tick
    // periódico (15min), não o backoff do WorkManager em si.
    await filaService.sincronizar();
    return true;
  });
}

/// Registra a tarefa periódica (OS-MOBILE-39) - chamado uma vez ao logar
/// (ver auth_gate.dart), idempotente (`ExistingPeriodicWorkPolicy.keep`
/// não duplica se já estiver registrada de uma sessão anterior do app).
class BackgroundSyncService {
  Future<void> registrar() async {
    await Workmanager().initialize(callbackDispatcherSincronizacao);
    await Workmanager().registerPeriodicTask(
      nomeTarefaSincronizacaoFila,
      nomeTarefaSincronizacaoFila,
      frequency: _intervaloMinimoAndroid,
      // WorkManager só chama o callback quando HÁ rede - dispensa checagem
      // manual de conectividade dentro da tarefa.
      constraints: Constraints(networkType: NetworkType.connected),
      existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
    );
  }
}

final backgroundSyncServiceProvider = Provider<BackgroundSyncService>((ref) {
  return BackgroundSyncService();
});
