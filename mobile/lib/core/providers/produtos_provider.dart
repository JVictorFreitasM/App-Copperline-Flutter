import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../local_db/offline_fallback.dart';
import '../models/produto.dart';
import '../pagination.dart';
import 'clientes_provider.dart' show limitePorPagina;
import 'offline_provider.dart';

typedef ProdutosParametros = ({int pagina, String? nome, String? codigo, String? gtin});

final produtosProvider = FutureProvider.family<
  PaginatedResult<ProdutoResumo>,
  ProdutosParametros
>((ref, params) async {
  final apiClient = ref.watch(apiClientProvider);
  final query = {
    'page': '${params.pagina}',
    'limit': '$limitePorPagina',
    if (params.nome != null && params.nome!.isNotEmpty) 'nome': params.nome!,
    if (params.codigo != null && params.codigo!.isNotEmpty) 'codigo': params.codigo!,
    if (params.gtin != null && params.gtin!.isNotEmpty) 'gtin': params.gtin!,
  };
  try {
    final json = await apiClient.getJson('/produtos?${Uri(queryParameters: query).query}');
    return PaginatedResult.fromJson(json, ProdutoResumo.fromJson);
  } catch (_) {
    // Sem rede - le do espelho local (OS-MOBILE-22).
    final snapshotService = await ref.read(snapshotServiceProvider.future);
    final todos = await snapshotService.produtos();
    if (todos.isEmpty) rethrow;
    return filtrarEPaginarLocal(
      todos: todos,
      pagina: params.pagina,
      limite: limitePorPagina,
      filtro: (p) =>
          (params.nome == null || params.nome!.isEmpty || (p.nome?.toLowerCase().contains(params.nome!.toLowerCase()) ?? false)) &&
          (params.codigo == null || params.codigo!.isEmpty || (p.codigo?.contains(params.codigo!) ?? false)) &&
          (params.gtin == null || params.gtin!.isEmpty || (p.gtin?.contains(params.gtin!) ?? false)),
    );
  }
});

final produtoDetalheProvider = FutureProvider.family<ProdutoDetalhe, String>((ref, id) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/produtos/${Uri.encodeComponent(id)}');
  return ProdutoDetalhe.fromJson(json);
});
