import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/nota_fiscal.dart';
import '../pagination.dart';
import 'clientes_provider.dart' show limitePorPagina;

typedef ListaNotasFiscais = ({PaginatedResult<NotaFiscal> resultado, String aviso});

/// `GET /notas-fiscais` (mesma tela standalone do web, `frontend/src/app/
/// notas-fiscais/page.tsx`) - sem filtro nenhum, só lista+paginação (mesma
/// decisão do web, fora de escopo por enquanto). `aviso` (janela de
/// sincronização de 60 dias) vem pronto do backend - só exibe, sem
/// duplicar o texto (mesmo critério do web).
final notasFiscaisProvider = FutureProvider.family<ListaNotasFiscais, int>((ref, pagina) async {
  final apiClient = ref.watch(apiClientProvider);
  final query = {'page': '$pagina', 'limit': '$limitePorPagina'};
  final json = await apiClient.getJson('/notas-fiscais?${Uri(queryParameters: query).query}');
  return (
    resultado: PaginatedResult.fromJson(json, NotaFiscal.fromJson),
    aviso: json['aviso'] as String? ?? '',
  );
});
