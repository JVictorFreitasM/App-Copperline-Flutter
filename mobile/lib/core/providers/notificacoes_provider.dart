import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/notificacao.dart';
import '../pagination.dart';
import 'clientes_provider.dart' show limitePorPagina;

typedef NotificacoesParametros = ({int pagina, bool apenasNaoLidas});

final notificacoesProvider = FutureProvider.family<
  PaginatedResult<Notificacao>,
  NotificacoesParametros
>((ref, params) async {
  final apiClient = ref.watch(apiClientProvider);
  final query = {
    'page': '${params.pagina}',
    'limit': '$limitePorPagina',
    if (params.apenasNaoLidas) 'apenasNaoLidas': 'true',
  };
  final json = await apiClient.getJson('/notificacoes?${Uri(queryParameters: query).query}');
  return PaginatedResult.fromJson(json, Notificacao.fromJson);
});

/// GET /notificacoes/contagem-nao-lidas - polling fica a cargo de quem
/// observa (ver `_CabecalhoApp` em app_shell.dart, `Timer.periodic`
/// chamando `ref.invalidate` a cada 60s, mesmo intervalo do sino no web).
final contagemNaoLidasProvider = FutureProvider<int>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/notificacoes/contagem-nao-lidas');
  return json['quantidade'] as int;
});

final notificacoesServiceProvider = Provider<NotificacoesService>((ref) {
  return NotificacoesService(ref.watch(apiClientProvider));
});

class NotificacoesService {
  NotificacoesService(this._apiClient);

  final ApiClient _apiClient;

  Future<void> marcarComoLida(String id) {
    return _apiClient.patchJson('/notificacoes/${Uri.encodeComponent(id)}/lida', {});
  }

  Future<void> marcarTodasComoLidas() {
    return _apiClient.patchJson('/notificacoes/marcar-todas-lidas', {});
  }
}
