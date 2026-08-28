import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../local_db/offline_fallback.dart';
import '../models/pedido.dart';
import '../pagination.dart';
import 'clientes_provider.dart' show limitePorPagina;
import 'offline_provider.dart';

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
  try {
    final json = await apiClient.getJson('/pedidos?${Uri(queryParameters: query).query}');
    return PaginatedResult.fromJson(json, PedidoResumo.fromJson);
  } catch (_) {
    // Sem rede - le do espelho local (OS-MOBILE-22). Snapshot so' traz os
    // pedidos mais recentes do vendedor (LIMITE_PEDIDOS_RECENTES no
    // backend) - fallback e' parcial de proposito, nao o historico
    // completo (mesma limitacao aceita pro snapshot como um todo).
    final snapshotService = await ref.read(snapshotServiceProvider.future);
    final todos = await snapshotService.pedidos();
    if (todos.isEmpty) rethrow;
    return filtrarEPaginarLocal(
      todos: todos,
      pagina: params.pagina,
      limite: limitePorPagina,
      filtro: (p) =>
          (params.clienteNome == null || params.clienteNome!.isEmpty || (p.tituloCliente.toLowerCase().contains(params.clienteNome!.toLowerCase()))) &&
          (params.situacao == null || params.situacao!.isEmpty || p.situacao == params.situacao) &&
          (params.dataInicial == null || params.dataInicial!.isEmpty || (p.dataHoraUltimaAlteracao != null && p.dataHoraUltimaAlteracao!.compareTo(params.dataInicial!) >= 0)) &&
          (params.dataFinal == null || params.dataFinal!.isEmpty || (p.dataHoraUltimaAlteracao != null && p.dataHoraUltimaAlteracao!.compareTo(params.dataFinal!) <= 0)),
    );
  }
});

final pedidoDetalheProvider = FutureProvider.family<PedidoDetalhe, String>((ref, id) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/pedidos/${Uri.encodeComponent(id)}');
  return PedidoDetalhe.fromJson(json);
});
