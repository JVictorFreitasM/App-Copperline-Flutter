import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/busca.dart';

/// Busca global (OS-MOBILE-15) - GET /busca?q= (OS-BACKEND-18), mesmo
/// endpoint unificado que devolve cliente/produto/pedido numa chamada só.
final buscaProvider = FutureProvider.family<BuscaResultado, String>((ref, termo) async {
  final apiClient = ref.watch(apiClientProvider);
  final query = Uri(queryParameters: {'q': termo}).query;
  final json = await apiClient.getJson('/busca?$query');
  return BuscaResultado.fromJson(json);
});
