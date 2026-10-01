import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../local_db/catalogo_local.dart';
import '../models/pagamento.dart';
import 'offline_provider.dart';

/// Catálogos pra criação de pedido (OS-BACKEND-25) - listas curtas e
/// estáveis (~17 formas, ~100 condições), sem paginação/busca, mesmo
/// critério do web (`frontend/src/app/pedidos/novo/page.tsx`, que também
/// carrega tudo de uma vez pra popular os seletores). Cada download fica
/// guardado no banco local (CatalogoLocal): sem rede, o formulário de
/// pedido continua tendo o que mostrar nos seletores - sem isso não dava
/// pra montar um pedido offline pra enviar depois.
final formasPagamentoProvider = FutureProvider<List<FormaPagamento>>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final db = await ref.watch(localDatabaseProvider.future);
  final json = await CatalogoLocal(
    db,
  ).comFallback('formasPagamento', () => apiClient.getJsonList('/formas-pagamento'));
  return json.map(FormaPagamento.fromJson).toList();
});

final condicoesPagamentoProvider = FutureProvider<List<CondicaoPagamento>>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final db = await ref.watch(localDatabaseProvider.future);
  final json = await CatalogoLocal(
    db,
  ).comFallback('condicoesPagamento', () => apiClient.getJsonList('/condicoes-pagamento'));
  return json.map(CondicaoPagamento.fromJson).toList();
});
