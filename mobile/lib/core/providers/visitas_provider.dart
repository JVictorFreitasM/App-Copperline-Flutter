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
