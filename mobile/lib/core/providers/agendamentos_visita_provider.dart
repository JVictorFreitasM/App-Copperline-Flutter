import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/agendamento_visita.dart';

/// Agendamentos de visita do PRÓPRIO vendedor, pro cliente em questão
/// (OS-novas-implementacoes.md Bloco 5) - GET /agendamentos-visita?clienteId=,
/// escopado no backend (AgendamentosVisitaService.listarPorVendedor -
/// mesmo critério individual de minhasVisitasProvider).
final agendamentosPorClienteProvider = FutureProvider.family<List<AgendamentoVisita>, String>((
  ref,
  clienteId,
) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJsonList(
    '/agendamentos-visita?clienteId=${Uri.encodeComponent(clienteId)}',
  );
  return json.map(AgendamentoVisita.fromJson).toList();
});

class AgendamentosVisitaService {
  AgendamentosVisitaService(this._apiClient);

  final ApiClient _apiClient;

  Future<AgendamentoVisita> criar({
    required String clienteId,
    required DateTime dataHoraPrevista,
  }) async {
    final json = await _apiClient.postJson('/agendamentos-visita', {
      'clienteId': clienteId,
      'dataHoraPrevista': dataHoraPrevista.toIso8601String(),
    });
    return AgendamentoVisita.fromJson(json);
  }
}

final agendamentosVisitaServiceProvider = Provider<AgendamentosVisitaService>((ref) {
  return AgendamentosVisitaService(ref.watch(apiClientProvider));
});
