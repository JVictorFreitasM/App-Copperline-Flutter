import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../local_db/offline_fallback.dart';
import '../models/cliente.dart';
import '../models/timeline_evento.dart';
import '../models/visita.dart';
import '../pagination.dart';
import 'offline_provider.dart';

const limitePorPagina = 20;

/// 'comPedido'/'semVisita' (ajustes-layout-mobile, item 6 - chips "Todos"/
/// "Com pedido"/"Sem visita") - mesmos dois valores de
/// `ListarClientesQueryDto.filtro` no backend (`filtro=com_pedido`/
/// `filtro=sem_visita`); null é "Todos", sem filtro extra.
enum FiltroClientes { comPedido, semVisita }

extension on FiltroClientes {
  String get valorQuery => switch (this) {
    FiltroClientes.comPedido => 'com_pedido',
    FiltroClientes.semVisita => 'sem_visita',
  };
}

/// Record (equalidade estrutural nativa do Dart 3) em vez de classe própria
/// - chave do `family` só precisa comparar por valor, sem boilerplate de
/// `==`/`hashCode`.
typedef ClientesParametros = ({
  int pagina,
  String? nome,
  String? cpfCnpj,
  FiltroClientes? filtro,
});

final clientesProvider = FutureProvider.family<
  PaginatedResult<ClienteResumo>,
  ClientesParametros
>((ref, params) async {
  final apiClient = ref.watch(apiClientProvider);
  final query = {
    'page': '${params.pagina}',
    'limit': '$limitePorPagina',
    if (params.nome != null && params.nome!.isNotEmpty) 'nome': params.nome!,
    if (params.cpfCnpj != null && params.cpfCnpj!.isNotEmpty) 'cpfCnpj': params.cpfCnpj!,
    if (params.filtro != null) 'filtro': params.filtro!.valorQuery,
  };
  try {
    final json = await apiClient.getJson('/clientes?${Uri(queryParameters: query).query}');
    return PaginatedResult.fromJson(json, ClienteResumo.fromJson);
  } catch (_) {
    // Sem rede - lê do espelho local (OS-MOBILE-22, "app funciona para
    // leitura totalmente offline após o primeiro snapshot"). Se nem o
    // snapshot existir ainda, deixa a exceção original propagar (nada
    // pra mostrar de qualquer forma). O filtro de chip (com pedido/sem
    // visita) NÃO é aplicado aqui - o snapshot local não carrega esse dado
    // agregado (evita inflar o snapshot só pra um caso raro: filtro de
    // chip + offline ao mesmo tempo); nome/cpfCnpj continuam funcionando
    // offline normalmente.
    final snapshotService = await ref.read(snapshotServiceProvider.future);
    final todos = await snapshotService.clientes();
    if (todos.isEmpty) rethrow;
    return filtrarEPaginarLocal(
      todos: todos,
      pagina: params.pagina,
      limite: limitePorPagina,
      filtro: (c) =>
          (params.nome == null || params.nome!.isEmpty || c.titulo.toLowerCase().contains(params.nome!.toLowerCase())) &&
          (params.cpfCnpj == null || params.cpfCnpj!.isEmpty || (c.cpfCnpj?.contains(params.cpfCnpj!) ?? false)),
    );
  }
});

final clienteDetalheProvider = FutureProvider.family<ClienteDetalhe, String>((ref, id) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/clientes/${Uri.encodeComponent(id)}');
  return ClienteDetalhe.fromJson(json);
});

// Estatísticas de carteira (OS-MOBILE-25, GET /clientes/:id/estatisticas,
// OS-BACKEND-26) - mesmo default de meses do backend
// (ClienteEstatisticasQueryDto, 12).
final clienteEstatisticasProvider = FutureProvider.family<ClienteEstatisticas, String>((
  ref,
  id,
) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJson('/clientes/${Uri.encodeComponent(id)}/estatisticas');
  return ClienteEstatisticas.fromJson(json);
});

// Histórico de visitas DESTE cliente (OS-MOBILE-25, GET /clientes/:id/visitas,
// OS-BACKEND-28) - diferente de minhasVisitasProvider (agenda do dia, ver
// visitas_provider.dart): aqui é o histórico completo de um cliente
// específico, sem filtro de data.
final clienteVisitasProvider = FutureProvider.family<List<Visita>, String>((ref, id) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJsonList('/clientes/${Uri.encodeComponent(id)}/visitas');
  return json.map(Visita.fromJson).toList();
});

// Timeline unificada (OS-MOBILE-40, GET /clientes/:id/timeline) - combina
// pedido/status/visita/nota fiscal, ja ordenada do mais recente pro mais
// antigo pelo backend (ver cliente-timeline.service.ts).
final clienteTimelineProvider = FutureProvider.family<List<TimelineEvento>, String>((
  ref,
  id,
) async {
  final apiClient = ref.watch(apiClientProvider);
  final json = await apiClient.getJsonList('/clientes/${Uri.encodeComponent(id)}/timeline');
  return json.map(TimelineEvento.fromJson).toList();
});

// Define/redefine o "pin" de localização do cliente (PATCH
// /clientes/:id/localizacao, OS-MOBILE-21) - fecha a lacuna deixada pela
// OS-MOBILE-17 (o roteiro já orientava "defina o pin no detalhe do
// cliente", mas essa ação não existia no app ainda). Deliberadamente
// desacoplado do fluxo de check-in (mesma decisão já tomada no backend,
// ver ClienteLocalizacaoService).
final clienteLocalizacaoServiceProvider = Provider<ClienteLocalizacaoService>((ref) {
  return ClienteLocalizacaoService(ref.watch(apiClientProvider));
});

class ClienteLocalizacaoService {
  ClienteLocalizacaoService(this._apiClient);

  final ApiClient _apiClient;

  Future<void> definir({
    required String clienteId,
    required double latitude,
    required double longitude,
  }) {
    return _apiClient.patchJson('/clientes/${Uri.encodeComponent(clienteId)}/localizacao', {
      'latitude': latitude,
      'longitude': longitude,
    });
  }
}

// Verificação de conflito por CPF/CNPJ antes de prospectar (OS-MOBILE-24,
// GET /clientes/verificar-conflito) - rota SEM escopo por vendedor de
// propósito (ver ClientesController): a pergunta é "esse documento já é
// cliente de ALGUÉM", não "é meu cliente" - por isso não usa
// clientesProvider/escopo nenhum aqui.
class ConflitoCliente {
  const ConflitoCliente({required this.existe, required this.vendedorResponsavel});

  factory ConflitoCliente.fromJson(Map<String, dynamic> json) {
    return ConflitoCliente(
      existe: json['existe'] as bool,
      vendedorResponsavel: json['vendedorResponsavel'] as String?,
    );
  }

  final bool existe;
  final String? vendedorResponsavel;
}

final conflitoClienteServiceProvider = Provider<ConflitoClienteService>((ref) {
  return ConflitoClienteService(ref.watch(apiClientProvider));
});

class ConflitoClienteService {
  ConflitoClienteService(this._apiClient);

  final ApiClient _apiClient;

  Future<ConflitoCliente> verificar(String documento) async {
    final documentoNormalizado = documento.replaceAll(RegExp(r'\D'), '');
    final json = await _apiClient.getJson(
      '/clientes/verificar-conflito?documento=$documentoNormalizado',
    );
    return ConflitoCliente.fromJson(json);
  }
}
