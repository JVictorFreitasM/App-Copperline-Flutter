import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/meu_vendedor.dart';
import '../models/solicitacao_desconto.dart';

/// GET /vendedores/me (OS-WEB-21/OS-MOBILE-26) - só pra decidir se mostra
/// o atalho de Aprovações, mesmo critério do web (app-shell.tsx).
final meuVendedorProvider = FutureProvider<MeuVendedor>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/vendedores/me');
  return MeuVendedor.fromJson(json);
});

/// Solicitações de desconto PENDENTES (OS-MOBILE-26, GET
/// /solicitacoes-desconto) - escopadas por hierarquia no próprio backend
/// (SolicitacoesDescontoService.listarPendentes); 403 quando quem chama
/// não tem papel de supervisão vira ApiException(statusCode: 403), tratado
/// na tela (mesmo padrão de VisitasController/RastreioController).
final solicitacoesPendentesProvider = FutureProvider<List<SolicitacaoDescontoResumo>>((
  ref,
) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJsonList('/solicitacoes-desconto');
  return json.map(SolicitacaoDescontoResumo.fromJson).toList();
});

final solicitacoesDescontoServiceProvider = Provider<SolicitacoesDescontoService>((ref) {
  return SolicitacoesDescontoService(ref.watch(apiClientProvider));
});

class SolicitacoesDescontoService {
  SolicitacoesDescontoService(this._apiClient);

  final ApiClient _apiClient;

  Future<void> aprovar(String id) {
    return _apiClient.postJson('/solicitacoes-desconto/${Uri.encodeComponent(id)}/aprovar', {});
  }

  Future<void> rejeitar(String id) {
    return _apiClient.postJson('/solicitacoes-desconto/${Uri.encodeComponent(id)}/rejeitar', {});
  }
}
