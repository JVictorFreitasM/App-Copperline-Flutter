import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/documento.dart';
import '../pagination.dart';
import 'clientes_provider.dart' show limitePorPagina;

typedef DocumentosParametros = ({int pagina, String? categoria});

final documentosProvider = FutureProvider.family<
  PaginatedResult<DocumentoResumo>,
  DocumentosParametros
>((ref, params) async {
  final apiClient = ref.watch(apiClientProvider);
  final query = {
    'page': '${params.pagina}',
    'limit': '$limitePorPagina',
    if (params.categoria != null && params.categoria!.isNotEmpty)
      'categoria': params.categoria!,
  };
  final json = await apiClient.getJson('/documentos?${Uri(queryParameters: query).query}');
  return PaginatedResult.fromJson(json, DocumentoResumo.fromJson);
});
