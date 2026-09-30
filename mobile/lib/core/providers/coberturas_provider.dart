import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/cobertura.dart';

/// GET /coberturas/minha-ativa - `null` quando o usuário não está
/// substituindo ninguém agora. `ApiClient.getJson` nunca devolve `null` de
/// verdade (corpo `null` vira `{}`, ver `ApiClient.getJson`) - por isso o
/// critério aqui é a ausência de `id` no mapa, não o mapa em si.
final minhaCoberturaAtivaProvider = FutureProvider<CoberturaTemporaria?>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/coberturas/minha-ativa');
  if (json['id'] == null) return null;
  return CoberturaTemporaria.fromJson(json);
});

/// GET /coberturas/:id/resumo - pode demorar alguns segundos na primeira
/// chamada (um resumo por IA por cliente da carteira original, sem cache
/// ainda quente - ver comentário no backend, cobertura-resumo.service.ts).
final coberturaResumoProvider = FutureProvider.family<CoberturaResumo, String>((
  ref,
  coberturaId,
) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/coberturas/${Uri.encodeComponent(coberturaId)}/resumo');
  return CoberturaResumo.fromJson(json);
});
