import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/cliente.dart';
import '../pagination.dart';

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
  final json = await apiClient.getJson('/clientes?${Uri(queryParameters: query).query}');
  return PaginatedResult.fromJson(json, ClienteResumo.fromJson);
});

final clienteDetalheProvider = FutureProvider.family<ClienteDetalhe, String>((ref, id) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/clientes/${Uri.encodeComponent(id)}');
  return ClienteDetalhe.fromJson(json);
});
