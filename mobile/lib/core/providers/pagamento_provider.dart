import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/pagamento.dart';

/// Catálogos pra criação de pedido (OS-BACKEND-25) - listas curtas e
/// estáveis (~17 formas, ~100 condições), sem paginação/busca, mesmo
/// critério do web (`frontend/src/app/pedidos/novo/page.tsx`, que também
/// carrega tudo de uma vez pra popular os seletores).
final formasPagamentoProvider = FutureProvider<List<FormaPagamento>>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJsonList('/formas-pagamento');
  return json.map(FormaPagamento.fromJson).toList();
});

final condicoesPagamentoProvider = FutureProvider<List<CondicaoPagamento>>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJsonList('/condicoes-pagamento');
  return json.map(CondicaoPagamento.fromJson).toList();
});
