import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/visita.dart';

/// Agenda do proprio vendedor (OS-MOBILE-17) - GET /visitas/minhas?data=,
/// deliberadamente diferente de GET /visitas (supervisor-only, ver
/// backend VisitasController). `data` no formato YYYY-MM-DD.
final minhasVisitasProvider = FutureProvider.family<List<Visita>, String>((ref, data) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJsonList('/visitas/minhas?data=$data');
  return json.map(Visita.fromJson).toList();
});

/// Check-in/checkout/cancelamento de visita (OS-MOBILE-21) - só as
/// chamadas em si; validação de raio/foto é responsabilidade do backend
/// (VisitasService, OS-BACKEND-28) - aqui só repassa e deixa o
/// ApiException subir pra tela mostrar a mensagem exata do servidor. Sem
/// estado próprio (não é um `AsyncNotifier`) porque cada ação já devolve a
/// Visita atualizada direto - quem chama decide o que fazer com o
/// resultado (ex: invalidar minhasVisitasProvider).
class VisitasAcoesService {
  VisitasAcoesService(this._apiClient);

  final ApiClient _apiClient;

  Future<Visita> checkin({
    required String clienteId,
    required double latitude,
    required double longitude,
    required String caminhoFoto,
    String? nota,
  }) async {
    final json = await _apiClient.postMultipart('/visitas/checkin', {
      'clienteId': clienteId,
      'latitude': latitude.toString(),
      'longitude': longitude.toString(),
      if (nota != null && nota.isNotEmpty) 'nota': nota,
    }, caminhoFoto);
    return Visita.fromJson(json);
  }

  Future<Visita> checkout({
    required String visitaId,
    required double latitude,
    required double longitude,
    String? nota,
  }) async {
    final json = await _apiClient.postJson('/visitas/$visitaId/checkout', {
      'latitude': latitude,
      'longitude': longitude,
      if (nota != null && nota.isNotEmpty) 'nota': nota,
    });
    return Visita.fromJson(json);
  }

  Future<Visita> cancelar({required String visitaId, required String comentario}) async {
    final json = await _apiClient.postJson('/visitas/$visitaId/cancelar', {
      'comentario': comentario,
    });
    return Visita.fromJson(json);
  }
}

final visitasAcoesServiceProvider = Provider<VisitasAcoesService>((ref) {
  return VisitasAcoesService(ref.watch(apiClientProvider));
});
