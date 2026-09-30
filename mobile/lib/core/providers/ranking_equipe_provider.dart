import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../api_exception.dart';
import '../models/ranking_equipe.dart';
import 'indicadores_home_provider.dart' show mesAnoAtual;

/// GET /equipe/ranking?mesAno=YYYY-MM (mensal, sem periodicidade semanal -
/// diferente de meta-progresso). 403 quando o perfil de quem chama não tem
/// direito a ver ranking (ex: vendedor comum com
/// ConfiguracaoGamificacao.rankingVisivelParaVendedor desligado) é tratado
/// como "seção ausente" (retorna null), NÃO como erro de conexão - mesmo
/// critério do web (`frontend/src/app/metas/page.tsx`, catch → ranking =
/// null).
final rankingEquipeProvider = FutureProvider<List<RankingEquipeItem>?>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  try {
    final json = await apiClient.getJsonList('/equipe/ranking?mesAno=${mesAnoAtual()}');
    return json.map(RankingEquipeItem.fromJson).toList();
  } on ApiException catch (erro) {
    if (erro.statusCode == 403) return null;
    rethrow;
  }
});
