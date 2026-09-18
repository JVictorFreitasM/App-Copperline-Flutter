import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/horario_trabalho.dart';

/// GET/PATCH /vendedores/me/horario-trabalho (Épico 4, config-aba-
/// rastreio.jpg) - sempre o PRÓPRIO vendedor de quem está logado, mesmo
/// critério de GET /vendedores/me.
final horarioTrabalhoProvider = FutureProvider<HorarioTrabalho>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/vendedores/me/horario-trabalho');
  return HorarioTrabalho.fromJson(json);
});

final horarioTrabalhoServiceProvider = Provider<HorarioTrabalhoService>((ref) {
  return HorarioTrabalhoService(ref.watch(apiClientProvider));
});

class HorarioTrabalhoService {
  HorarioTrabalhoService(this._apiClient);

  final ApiClient _apiClient;

  Future<HorarioTrabalho> atualizar({
    required String horarioInicioTrabalho,
    required String horarioFimTrabalho,
  }) async {
    final json = await _apiClient.patchJson('/vendedores/me/horario-trabalho', {
      'horarioInicioTrabalho': horarioInicioTrabalho,
      'horarioFimTrabalho': horarioFimTrabalho,
    });
    return HorarioTrabalho.fromJson(json);
  }
}
