import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/cliente_resumo_llm.dart';

/// Resumo de carteira via IA (OS-MOBILE-18) - GET /clientes/:id/resumo
/// (OS-BACKEND-20). Chamada pode demorar mais que o normal (depende de
/// LLM externo, sem cache) - por isso um provider próprio, separado do
/// resto do detalhe do cliente, pra não travar o resto da tela enquanto
/// carrega (ver ClienteDetalheScreen).
final clienteResumoLlmProvider = FutureProvider.family<ClienteResumoLlm, String>((
  ref,
  clienteId,
) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/clientes/${Uri.encodeComponent(clienteId)}/resumo');
  return ClienteResumoLlm.fromJson(json);
});
