import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/estoque.dart';
import '../models/indicadores_home.dart';
import '../models/produto.dart';
import 'aprovacoes_provider.dart';
import 'favoritos_provider.dart';
import 'produtos_provider.dart';

String _mesAnoAtual() => DateTime.now().toIso8601String().substring(0, 7);

// "YYYY-Www" da semana ISO-8601 atual (segunda a domingo) - mesmo
// algoritmo de backend/src/metas/filtro-semana.ts (semanaIsoAtual) e
// frontend/src/lib/metas.ts, pedido do usuário 2026-09-29 (mobile passa a
// mostrar a meta semanal tambem, nao so mensal).
String _semanaIsoAtual() {
  final agora = DateTime.now();
  final dataAlvo = DateTime.utc(agora.year, agora.month, agora.day);
  final diaSemanaIso = dataAlvo.weekday; // DateTime.weekday: 1=segunda..7=domingo, ja no padrao ISO
  final quinta = dataAlvo.add(Duration(days: 4 - diaSemanaIso));
  final anoIso = quinta.year;
  final primeiroDeJaneiro = DateTime.utc(anoIso, 1, 1);
  final numeroSemana =
      ((quinta.difference(primeiroDeJaneiro).inDays + 1) / 7).ceil();
  return '$anoIso-W${numeroSemana.toString().padLeft(2, '0')}';
}

/// Progresso da meta MENSAL do PROPRIO vendedor (OS-MOBILE-41 - gauge na
/// home), reaproveitando o endpoint da OS-BACKEND-44
/// (GET /vendedores/:id/meta-progresso). Depende de meuVendedorProvider pra
/// saber o proprio vendedorId - quem nao tem vendedor vinculado (ex: admin
/// puro) simplesmente nao ve o gauge (ver home_screen.dart).
final metaMensalProgressoProvider = FutureProvider<MetaProgresso?>((ref) async {
  final vendedorId = (await ref.watch(meuVendedorProvider.future)).vendedorId;
  if (vendedorId == null) return null;

  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson(
    '/vendedores/${Uri.encodeComponent(vendedorId)}/meta-progresso?periodicidade=MENSAL&periodo=${_mesAnoAtual()}',
  );
  return MetaProgresso.fromJson(json);
});

/// Progresso da meta SEMANAL do PROPRIO vendedor (pedido do usuário,
/// 2026-09-29) - mesmo endpoint/criterio do provider mensal acima, so que
/// com periodicidade=SEMANAL. Mensal e semanal podem coexistir (ver
/// MetaVendedorService no backend) - por isso dois providers/gauges
/// independentes, nao um so.
final metaSemanalProgressoProvider = FutureProvider<MetaProgresso?>((ref) async {
  final vendedorId = (await ref.watch(meuVendedorProvider.future)).vendedorId;
  if (vendedorId == null) return null;

  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson(
    '/vendedores/${Uri.encodeComponent(vendedorId)}/meta-progresso?periodicidade=SEMANAL&periodo=${_semanaIsoAtual()}',
  );
  return MetaProgresso.fromJson(json);
});

/// Evolucao semanal de vendas do PROPRIO vendedor (OS-MOBILE-41 -
/// sparkline na home), GET /vendedores/me/vendas-semanais.
final vendasSemanaisProvider = FutureProvider<List<SemanaVenda>>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJsonList('/vendedores/me/vendas-semanais');
  return json.map(SemanaVenda.fromJson).toList();
});

/// Saldo de estoque de UM produto pontual (OS-MOBILE-41 - barra de
/// progresso na home, pro produto favoritado do vendedor). Provider
/// dedicado em vez de reaproveitar `estoqueProvider` (core/providers/
/// estoque_provider.dart): aquele e' um Notifier imperativo amarrado ao
/// fluxo de busca manual da tela de estoque, nao a um `family` que a home
/// possa apenas `watch` por codigo de produto.
final estoqueProdutoProvider = FutureProvider.family<ResultadoEstoque?, String>((
  ref,
  codigo,
) async {
  final apiClient = ref.watch(apiClientProvider);
  try {
    final json = await apiClient.getJson('/estoque/${Uri.encodeComponent(codigo)}');
    return ResultadoEstoque.fromJson(json);
  } catch (_) {
    // Indicador secundario da home - se o produto favoritado nao existir
    // mais ou a consulta falhar, o card so' some (mesmo criterio de
    // "sem dado real, sem card" do resto da home), sem propagar erro.
    return null;
  }
});

class ProdutoComEstoque {
  const ProdutoComEstoque({required this.produto, required this.estoque});
  final ProdutoDetalhe produto;
  final ResultadoEstoque estoque;
}

/// Combina o primeiro produto favoritado (FavoritosNotifier, OS-MOBILE-15 -
/// sem endpoint de "mais acessado" nunca ter existido, o favorito local e'
/// o melhor sinal real de "produto que o vendedor acompanha") com seu
/// saldo de estoque atual. `null` sem produto favoritado, sem estoque
/// sincronizado, ou em qualquer falha - mesmo criterio de "sem card sem
/// dado real" do resto da home.
final produtoFavoritoComEstoqueProvider = FutureProvider<ProdutoComEstoque?>((ref) async {
  final favoritos = await ref.watch(favoritosProvider.future);
  final produtosFavoritos = favoritos[TipoFavorito.produto] ?? const {};
  if (produtosFavoritos.isEmpty) return null;

  final produtoId = produtosFavoritos.first;
  try {
    final produto = await ref.watch(produtoDetalheProvider(produtoId).future);
    if (produto.codigo == null) return null;
    final estoque = await ref.watch(estoqueProdutoProvider(produto.codigo!).future);
    if (estoque == null || estoque.itens.isEmpty) return null;
    return ProdutoComEstoque(produto: produto, estoque: estoque);
  } catch (_) {
    return null;
  }
});
