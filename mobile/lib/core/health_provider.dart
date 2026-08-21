import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';

/// Espelha a resposta de `GET /health` do backend (ver
/// `backend/src/health`) - só os campos que a tela inicial mostra.
class HealthStatus {
  HealthStatus({required this.status, required this.details});

  final String status;
  final Map<String, dynamic> details;

  bool get ok => status == 'ok';
}

/// Estado assíncrono (chamada de rede) fica em `AsyncNotifier`, nunca
/// dentro do widget (ver skill `flutter-widget`) - a tela só consome
/// `AsyncValue<HealthStatus>` e trata os três estados.
class HealthNotifier extends AsyncNotifier<HealthStatus> {
  @override
  Future<HealthStatus> build() async {
    final apiClient = ref.watch(apiClientProvider);
    final json = await apiClient.getJson('/health');
    return HealthStatus(
      status: json['status'] as String? ?? 'desconhecido',
      details: (json['details'] as Map<String, dynamic>?) ?? const {},
    );
  }

  Future<void> recarregar() async {
    ref.invalidateSelf();
    await future;
  }
}

final healthProvider = AsyncNotifierProvider<HealthNotifier, HealthStatus>(
  HealthNotifier.new,
);
