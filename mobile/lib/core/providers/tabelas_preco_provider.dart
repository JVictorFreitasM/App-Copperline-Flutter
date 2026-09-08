import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/tabela_preco.dart';
import '../pagination.dart';

/// Tabelas de preço sincronizadas via Empresarial.svc/BuscarTabelasPreco
/// (mesmo padrão do web, `frontend/src/app/tabelas-preco/page.tsx`) - sem
/// paginação (poucas dezenas de tabelas), sem fallback offline (não faz
/// parte do snapshot de sincronização offline, OS-MOBILE-22).
final tabelasPrecoProvider = FutureProvider<List<TabelaPrecoResumo>>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJsonList('/tabelas-preco');
  return json.map(TabelaPrecoResumo.fromJson).toList();
});

final tabelaPrecoDetalheProvider = FutureProvider.family<TabelaPrecoResumo, String>((
  ref,
  id,
) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/tabelas-preco/${Uri.encodeComponent(id)}');
  return TabelaPrecoResumo.fromJson(json);
});

typedef ItensTabelaPrecoParametros = ({String tabelaId, int pagina});

final itensTabelaPrecoProvider = FutureProvider.family<
  PaginatedResult<ItemTabelaPreco>,
  ItensTabelaPrecoParametros
>((ref, params) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson(
    '/tabelas-preco/${Uri.encodeComponent(params.tabelaId)}/itens?page=${params.pagina}&limit=30',
  );
  return PaginatedResult.fromJson(json, ItemTabelaPreco.fromJson);
});
