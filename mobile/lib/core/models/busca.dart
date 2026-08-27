import 'cliente.dart';
import 'pedido.dart';
import 'produto.dart';

/// Mesmo shape de `backend/src/busca/dto/busca-resultado.dto.ts`
/// (BuscaResultadoDto, GET /busca, OS-BACKEND-18) - cliente/produto/pedido
/// numa chamada só, cada um reaproveitando o resumo já usado nas
/// listagens próprias (ClienteResumo/ProdutoResumo/PedidoResumo), mesmo
/// shape retornado pelo backend nos três casos.
class BuscaResultado {
  const BuscaResultado({required this.clientes, required this.produtos, required this.pedidos});

  factory BuscaResultado.fromJson(Map<String, dynamic> json) {
    return BuscaResultado(
      clientes: (json['clientes'] as List)
          .cast<Map<String, dynamic>>()
          .map(ClienteResumo.fromJson)
          .toList(),
      produtos: (json['produtos'] as List)
          .cast<Map<String, dynamic>>()
          .map(ProdutoResumo.fromJson)
          .toList(),
      pedidos: (json['pedidos'] as List)
          .cast<Map<String, dynamic>>()
          .map(PedidoResumo.fromJson)
          .toList(),
    );
  }

  final List<ClienteResumo> clientes;
  final List<ProdutoResumo> produtos;
  final List<PedidoResumo> pedidos;

  bool get vazio => clientes.isEmpty && produtos.isEmpty && pedidos.isEmpty;
}
