import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import '../models/cliente.dart';
import '../pagination.dart';

const _limiteMaximoPorPagina = 100; // maior limite aceito por PaginationQueryDto (backend)

/// Clientes da carteira do vendedor logado, com "pin" de localização
/// definido (OS-MOBILE-17) - GET /clientes já vem escopado por vendedor
/// (VendedorEscopoService, OS-BACKEND-23), então não precisa filtrar aqui
/// além de "tem localizacaoLat/Lng". Busca TODAS as páginas (sem
/// roteirização otimizada nesta fase - só exibição dos pontos, critério
/// de aceite explícito da OS - por isso ok trazer tudo de uma vez em vez
/// de paginar o mapa).
final clientesComLocalizacaoProvider = FutureProvider<List<ClienteResumo>>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final clientes = <ClienteResumo>[];

  var pagina = 1;
  while (true) {
    final json = await apiClient.getJson('/clientes?page=$pagina&limit=$_limiteMaximoPorPagina');
    final resultado = PaginatedResult.fromJson(json, ClienteResumo.fromJson);
    clientes.addAll(resultado.data);
    if (resultado.page >= resultado.totalPages) {
      break;
    }
    pagina++;
  }

  return clientes.where((cliente) => cliente.temLocalizacao).toList();
});
