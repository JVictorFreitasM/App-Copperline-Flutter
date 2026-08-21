import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/pedido.dart';
import '../pagination.dart';
import 'clientes_provider.dart' show limitePorPagina;

typedef PedidosParametros = ({
  int pagina,
  String? clienteNome,
  String? situacao,
  String? dataInicial,
  String? dataFinal,
});

final pedidosProvider = FutureProvider.family<
  PaginatedResult<PedidoResumo>,
  PedidosParametros
>((ref, params) async {
  final apiClient = ref.watch(apiClientProvider);
  final query = {
    'page': '${params.pagina}',
    'limit': '$limitePorPagina',
    if (params.clienteNome != null && params.clienteNome!.isNotEmpty)
      'clienteNome': params.clienteNome!,
    if (params.situacao != null && params.situacao!.isNotEmpty) 'situacao': params.situacao!,
    if (params.dataInicial != null && params.dataInicial!.isNotEmpty)
      'dataInicial': params.dataInicial!,
    if (params.dataFinal != null && params.dataFinal!.isNotEmpty) 'dataFinal': params.dataFinal!,
  };
  final json = await apiClient.getJson('/pedidos?${Uri(queryParameters: query).query}');
  return PaginatedResult.fromJson(json, PedidoResumo.fromJson);
});

final pedidoDetalheProvider = FutureProvider.family<PedidoDetalhe, String>((ref, id) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/pedidos/${Uri.encodeComponent(id)}');
  return PedidoDetalhe.fromJson(json);
});
