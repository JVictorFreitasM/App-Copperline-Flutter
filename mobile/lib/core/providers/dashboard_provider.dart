import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/dashboard.dart';

/// Resumo do dia pra home (OS-MOBILE-14) - GET /dashboard/resumo e GET
/// /dashboard/estoque-critico (mesmos endpoints da OS-BACKEND-17 já
/// consumidos pelo painel web, OS-WEB-19). Dois providers independentes
/// (não um combinado) - mesmo critério de resiliência da OS-WEB-29: uma
/// falha isolada num dos dois não deve impedir o outro de aparecer.
final resumoDashboardProvider = FutureProvider<ResumoDashboard>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/dashboard/resumo');
  return ResumoDashboard.fromJson(json);
});

final estoqueCriticoDashboardProvider = FutureProvider<EstoqueCriticoDashboard>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/dashboard/estoque-critico');
  return EstoqueCriticoDashboard.fromJson(json);
});
