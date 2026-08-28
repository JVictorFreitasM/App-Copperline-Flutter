import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../local_db/offline_fallback.dart';
import '../models/cliente.dart';
import '../pagination.dart';
import 'offline_provider.dart';

const limitePorPagina = 20;

/// Record (equalidade estrutural nativa do Dart 3) em vez de classe própria
/// - chave do `family` só precisa comparar por valor, sem boilerplate de
/// `==`/`hashCode`.
typedef ClientesParametros = ({int pagina, String? nome, String? cpfCnpj});

final clientesProvider = FutureProvider.family<
  PaginatedResult<ClienteResumo>,
  ClientesParametros
>((ref, params) async {
  final apiClient = ref.watch(apiClientProvider);
  final query = {
    'page': '${params.pagina}',
    'limit': '$limitePorPagina',
    if (params.nome != null && params.nome!.isNotEmpty) 'nome': params.nome!,
    if (params.cpfCnpj != null && params.cpfCnpj!.isNotEmpty) 'cpfCnpj': params.cpfCnpj!,
  };
  try {
    final json = await apiClient.getJson('/clientes?${Uri(queryParameters: query).query}');
    return PaginatedResult.fromJson(json, ClienteResumo.fromJson);
  } catch (_) {
    // Sem rede - lê do espelho local (OS-MOBILE-22, "app funciona para
    // leitura totalmente offline após o primeiro snapshot"). Se nem o
    // snapshot existir ainda, deixa a exceção original propagar (nada
    // pra mostrar de qualquer forma).
    final snapshotService = await ref.read(snapshotServiceProvider.future);
    final todos = await snapshotService.clientes();
    if (todos.isEmpty) rethrow;
    return filtrarEPaginarLocal(
      todos: todos,
      pagina: params.pagina,
      limite: limitePorPagina,
      filtro: (c) =>
          (params.nome == null || params.nome!.isEmpty || c.titulo.toLowerCase().contains(params.nome!.toLowerCase())) &&
          (params.cpfCnpj == null || params.cpfCnpj!.isEmpty || (c.cpfCnpj?.contains(params.cpfCnpj!) ?? false)),
    );
  }
});

final clienteDetalheProvider = FutureProvider.family<ClienteDetalhe, String>((ref, id) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/clientes/${Uri.encodeComponent(id)}');
  return ClienteDetalhe.fromJson(json);
});
