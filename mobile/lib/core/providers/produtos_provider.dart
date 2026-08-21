import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/produto.dart';
import '../pagination.dart';
import 'clientes_provider.dart' show limitePorPagina;

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
  final json = await apiClient.getJson('/produtos?${Uri(queryParameters: query).query}');
  return PaginatedResult.fromJson(json, ProdutoResumo.fromJson);
});

final produtoDetalheProvider = FutureProvider.family<ProdutoDetalhe, String>((ref, id) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/produtos/${Uri.encodeComponent(id)}');
  return ProdutoDetalhe.fromJson(json);
});
