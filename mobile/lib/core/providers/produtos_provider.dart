import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../local_db/offline_fallback.dart';
import '../models/preco_tabela.dart';
import '../models/produto.dart';
import '../models/tipo_acondicionamento.dart';
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
  try {
    final json = await apiClient.getJson('/produtos/${Uri.encodeComponent(id)}');
    return ProdutoDetalhe.fromJson(json);
  } catch (_) {
    // Sem rede - le do espelho local (mesmo criterio de produtosProvider
    // acima). O snapshot so guarda o resumo (sem idGrade*), entao o
    // detalhe offline sai sem informacao de grade - degradacao honesta,
    // nao inventamos o que nao foi baixado.
    final snapshotService = await ref.read(snapshotServiceProvider.future);
    final todos = await snapshotService.produtos();
    ProdutoResumo? resumo;
    for (final p in todos) {
      if (p.id == id) {
        resumo = p;
        break;
      }
    }
    if (resumo == null) rethrow;
    return ProdutoDetalhe(
      id: resumo.id,
      codigo: resumo.codigo,
      nome: resumo.nome,
      tipo: resumo.tipo,
      inativo: resumo.inativo,
      precoVenda: resumo.precoVenda,
      gtin: resumo.gtin,
      idGrade1: null,
      idGrade2: null,
      idGrade3: null,
      tipoAcondicionamentoId: null,
    );
  }
});

/// GET /tipos-acondicionamento - lista fixa e pequena (poucos tipos
/// cadastrados), usada só pra resolver `tipoAcondicionamentoId` do produto
/// num nome exibível (ver produto_detalhe_screen.dart). Só ativos, mesmo
/// escopo do backend (`listarAtivos`).
final tiposAcondicionamentoProvider = FutureProvider<List<TipoAcondicionamento>>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJsonList('/tipos-acondicionamento');
  return json.map(TipoAcondicionamento.fromJson).toList();
});

/// GET /produtos/:id/precos (OS-novas-implementacoes.md Bloco 1,
/// "comparativo de preço por tabela") - sem clienteId, mesmo escopo do
/// web (`precos-por-tabela.tsx`, que também ainda não usa a variante
/// escopada por cliente).
final produtoPrecosProvider = FutureProvider.family<List<ProdutoPrecoPorTabela>, String>((
  ref,
  produtoId,
) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/produtos/${Uri.encodeComponent(produtoId)}/precos');
  return (json['tabelas'] as List)
      .cast<Map<String, dynamic>>()
      .map(ProdutoPrecoPorTabela.fromJson)
      .toList();
});
