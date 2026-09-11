import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _chaveServerUrl = 'server_base_url';

// --dart-define=API_BASE_URL continua funcionando como default INICIAL
// (permite gerar um build ja apontando pro servidor certo sem exigir
// digitar na primeira abertura) - deixou de ser a UNICA fonte de verdade:
// o usuario pode sobrescrever em runtime via ConfigurarServidorScreen, sem
// precisar de um novo build so porque o IP da rede mudou (DHCP).
const String _urlPadraoCompilada = String.fromEnvironment('API_BASE_URL');

/// Le/grava a URL base da API em disco (SharedPreferences - não é dado
/// sensível, diferente do cookie de sessão em [SessionStorage]).
class ServerConfigService {
  ServerConfigService(this._prefs);

  final SharedPreferences _prefs;

  // null = nem salva localmente, nem veio de --dart-define - primeira
  // abertura de um build genérico, precisa perguntar ao usuário antes de
  // qualquer tela que fale com a API (ver LoginScreen).
  String? obterUrl() {
    final salva = _prefs.getString(_chaveServerUrl);
    if (salva != null && salva.isNotEmpty) return salva;
    return _urlPadraoCompilada.isEmpty ? null : _urlPadraoCompilada;
  }

  Future<void> salvarUrl(String url) => _prefs.setString(_chaveServerUrl, url);
}

// Sobrescrito em main.dart (ProviderScope.overrides) com a instância já
// resolvida - nunca FutureProvider aqui: o app inteiro depende disso pra
// fazer qualquer chamada de rede (apiClientProvider, ver api_client.dart),
// um carregamento assíncrono espalharia AsyncValue por toda uma árvore de
// providers hoje síncrona. SharedPreferences.getInstance() é resolvido
// UMA vez, antes de runApp, igual já se faz com Firebase.initializeApp().
final serverConfigServiceProvider = Provider<ServerConfigService>((ref) {
  throw UnimplementedError(
    'serverConfigServiceProvider precisa ser sobrescrito em main.dart antes do runApp.',
  );
});

// Notifier (não Provider simples) - editável em runtime pela
// ConfigurarServidorScreen (ref.read(serverUrlProvider.notifier).state =
// novaUrl). Qualquer provider que dependa da URL (ex: apiClientProvider)
// observa este via ref.watch e é reconstruído automaticamente ao salvar
// uma nova URL, sem exigir reiniciar o app. Mesmo padrão de
// NotifierProvider já usado no projeto (ver estoque_provider.dart/
// rastreio_service.dart) - StateProvider não existe mais no Riverpod 3.
class ServerUrlNotifier extends Notifier<String?> {
  @override
  String? build() => ref.watch(serverConfigServiceProvider).obterUrl();

  // Chamado por ConfigurarServidorScreen APÓS persistir via
  // ServerConfigService.salvarUrl() - este notifier só reflete o valor em
  // memória pro resto do app reagir, não é dono da persistência em si.
  void definir(String url) => state = url;
}

final serverUrlProvider = NotifierProvider<ServerUrlNotifier, String?>(
  ServerUrlNotifier.new,
);
