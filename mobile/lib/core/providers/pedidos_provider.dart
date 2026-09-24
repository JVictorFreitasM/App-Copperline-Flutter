import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../local_db/offline_fallback.dart';
import '../models/pedido.dart';
import '../pagination.dart';
import 'clientes_provider.dart' show limitePorPagina;
import 'offline_provider.dart';

typedef PedidosParametros = ({
  int pagina,
  String? clienteNome,
  String? situacao,
  String? dataInicial,
  String? dataFinal,
  // Épico 4 (config-aba-orcamento.jpg) - "ORCAMENTO" pra listar só os
  // rascunhos (ver pedidos_screen.dart).
  String? statusAprovacao,
});

final pedidosProvider = FutureProvider.family<
  PaginatedResult<PedidoResumo>,
  PedidosParametros
>((ref, params) async {
  final apiClient = ref.watch(apiClientProvider);
  final query = {
    'page': '${params.pagina}',
    'limit': '$limitePorPagina',
    if (params.clienteNome != null && params.clienteNome!.isNotEmpty)
      'clienteNome': params.clienteNome!,
    if (params.situacao != null && params.situacao!.isNotEmpty) 'situacao': params.situacao!,
    if (params.dataInicial != null && params.dataInicial!.isNotEmpty)
      'dataInicial': params.dataInicial!,
    if (params.dataFinal != null && params.dataFinal!.isNotEmpty) 'dataFinal': params.dataFinal!,
    if (params.statusAprovacao != null && params.statusAprovacao!.isNotEmpty)
      'statusAprovacao': params.statusAprovacao!,
  };
  try {
    final json = await apiClient.getJson('/pedidos?${Uri(queryParameters: query).query}');
    return PaginatedResult.fromJson(json, PedidoResumo.fromJson);
  } catch (_) {
    // Sem rede - le do espelho local (OS-MOBILE-22). Snapshot so' traz os
    // pedidos mais recentes do vendedor (LIMITE_PEDIDOS_RECENTES no
    // backend) - fallback e' parcial de proposito, nao o historico
    // completo (mesma limitacao aceita pro snapshot como um todo).
    final snapshotService = await ref.read(snapshotServiceProvider.future);
    final todos = await snapshotService.pedidos();
    if (todos.isEmpty) rethrow;
    return filtrarEPaginarLocal(
      todos: todos,
      pagina: params.pagina,
      limite: limitePorPagina,
      filtro: (p) =>
          (params.clienteNome == null || params.clienteNome!.isEmpty || (p.tituloCliente.toLowerCase().contains(params.clienteNome!.toLowerCase()))) &&
          (params.situacao == null || params.situacao!.isEmpty || p.situacao == params.situacao) &&
          (params.dataInicial == null || params.dataInicial!.isEmpty || (p.dataHoraUltimaAlteracao != null && p.dataHoraUltimaAlteracao!.compareTo(params.dataInicial!) >= 0)) &&
          (params.dataFinal == null || params.dataFinal!.isEmpty || (p.dataHoraUltimaAlteracao != null && p.dataHoraUltimaAlteracao!.compareTo(params.dataFinal!) <= 0)) &&
          (params.statusAprovacao == null ||
              params.statusAprovacao!.isEmpty ||
              p.statusAprovacaoBucket == params.statusAprovacao),
    );
  }
});

final pedidoDetalheProvider = FutureProvider.family<PedidoDetalhe, String>((ref, id) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/pedidos/${Uri.encodeComponent(id)}');
  return PedidoDetalhe.fromJson(json);
});

// Criação de pedido (OS-BACKEND-25, criar_pedido_screen.dart) - dois
// endpoints reaproveitados, sem nenhum novo no backend: cálculo por item
// (POST /produtos/:id/calcular, mesmo usado na simulação da tela de
// produto) e criação em si (POST /pedidos, já existia pro web).
final criarPedidoServiceProvider = Provider<CriarPedidoService>((ref) {
  return CriarPedidoService(ref.watch(apiClientProvider));
});

class CriarPedidoService {
  CriarPedidoService(this._apiClient);

  final ApiClient _apiClient;

  Future<ResultadoCalculoQuantidade> calcular({
    required String produtoId,
    required double metrosDesejados,
  }) async {
    final json = await _apiClient.postJson(
      '/produtos/${Uri.encodeComponent(produtoId)}/calcular',
      {'metrosDesejados': metrosDesejados},
    );
    return ResultadoCalculoQuantidade.fromJson(json);
  }

  // Resposta (CriarPedidoResultadoDto) - devolve pedidoId E status (Épico
  // 4: antes só extraía o pedidoId, mas agora a tela precisa diferenciar
  // ENVIADO/AGUARDANDO_APROVACAO/ORCAMENTO pra mostrar a mensagem certa,
  // ver criar_pedido_screen.dart).
  //
  // latitude/longitude opcionais (Épico 4, config-aba-rastreio.jpg -
  // "Distância máxima do cliente para registro de pedido") - o app manda
  // best-effort quando consegue a posição (ver criar_pedido_screen.dart);
  // o backend só exige de verdade quando essa config tiver um valor
  // configurado (senão ignora).
  //
  // salvarComoOrcamento (Épico 4, config-aba-orcamento.jpg) - salva como
  // rascunho em vez de enviar ao ERP.
  Future<({String pedidoId, String status})> criar({
    required String clienteId,
    required double percentualDesconto,
    required String formaPagamentoId,
    required String condicaoPagamentoId,
    required List<Map<String, dynamic>> itens,
    double? latitude,
    double? longitude,
    bool? salvarComoOrcamento,
  }) async {
    final json = await _apiClient.postJson('/pedidos', {
      'clienteId': clienteId,
      'percentualDesconto': percentualDesconto,
      'formaPagamentoId': formaPagamentoId,
      'condicaoPagamentoId': condicaoPagamentoId,
      'itens': itens,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (salvarComoOrcamento != null) 'salvarComoOrcamento': salvarComoOrcamento,
    });
    return (pedidoId: json['pedidoId'] as String, status: json['status'] as String);
  }

  // Épico 4 - "transformar um Orçamento em Pedido". Mesmas 3 saídas de
  // criar() (ENVIADO/AGUARDANDO_APROVACAO), nunca ORCAMENTO de volta.
  Future<({String pedidoId, String status})> transformarEmPedido(String pedidoId) async {
    final json = await _apiClient.postJson(
      '/pedidos/${Uri.encodeComponent(pedidoId)}/transformar-em-pedido',
      {},
    );
    return (pedidoId: json['pedidoId'] as String, status: json['status'] as String);
  }

  // Épico 4 - cancela (apaga) um orçamento que nunca chegou no ERP.
  Future<void> cancelarOrcamento(String pedidoId) {
    return _apiClient.delete('/pedidos/${Uri.encodeComponent(pedidoId)}');
  }

  // Épico 4 - "Permitir alteração de vendedor de um orçamento criado",
  // só pra usuário gerencial (checado no backend).
  Future<void> alterarVendedorOrcamento(String pedidoId, String novoVendedorId) {
    return _apiClient.patchJson('/pedidos/${Uri.encodeComponent(pedidoId)}/vendedor', {
      'vendedorId': novoVendedorId,
    });
  }
}
