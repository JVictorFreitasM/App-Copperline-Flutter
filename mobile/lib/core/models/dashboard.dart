import 'pedido.dart';

/// Mesmo shape de `backend/src/dashboard/dto/resumo-dashboard.dto.ts`
/// (ResumoDashboardDto, GET /dashboard/resumo) - subconjunto usado pela
/// home mobile (OS-MOBILE-14): stat cards + pedidos recentes. notas
/// fiscais recentes ficam fora de escopo aqui (a OS só pede "pedidos
/// recentes, alertas de estoque baixo").
class ResumoDashboard {
  const ResumoDashboard({
    required this.clientesAtivos,
    required this.produtosAtivos,
    required this.pedidosEmAberto,
    required this.valorFaturadoRecente,
    required this.periodoValorFaturadoDias,
    required this.pedidosRecentes,
  });

  factory ResumoDashboard.fromJson(Map<String, dynamic> json) {
    return ResumoDashboard(
      clientesAtivos: json['clientesAtivos'] as int,
      produtosAtivos: json['produtosAtivos'] as int,
      pedidosEmAberto: json['pedidosEmAberto'] as int,
      valorFaturadoRecente: json['valorFaturadoRecente'] as String,
      periodoValorFaturadoDias: json['periodoValorFaturadoDias'] as int,
      pedidosRecentes: (json['pedidosRecentes'] as List)
          .cast<Map<String, dynamic>>()
          .map(PedidoResumo.fromJson)
          .toList(),
    );
  }

  final int clientesAtivos;
  final int produtosAtivos;
  final int pedidosEmAberto;
  final String valorFaturadoRecente;
  final int periodoValorFaturadoDias;
  final List<PedidoResumo> pedidosRecentes;
}

/// Mesmo shape de `backend/src/dashboard/dto/estoque-critico-dashboard.dto.ts`
/// (ProdutoEstoqueCriticoDto/EstoqueCriticoDashboardDto, GET
/// /dashboard/estoque-critico) - saldo baixo E com pelo menos 1 pedido em
/// aberto referenciando o produto (nunca "sem consumo recente" = crítico).
class ProdutoEstoqueCritico {
  const ProdutoEstoqueCritico({
    required this.produtoId,
    required this.nome,
    required this.codigo,
    required this.quantidadeDisponivel,
    required this.quantidadePedidosPendentes,
  });

  factory ProdutoEstoqueCritico.fromJson(Map<String, dynamic> json) {
    return ProdutoEstoqueCritico(
      produtoId: json['produtoId'] as String,
      nome: json['nome'] as String?,
      codigo: json['codigo'] as String,
      quantidadeDisponivel: json['quantidadeDisponivel'] as String,
      quantidadePedidosPendentes: json['quantidadePedidosPendentes'] as int,
    );
  }

  final String produtoId;
  final String? nome;
  final String codigo;
  final String quantidadeDisponivel;
  final int quantidadePedidosPendentes;

  String get titulo => nome ?? codigo;
}

class EstoqueCriticoDashboard {
  const EstoqueCriticoDashboard({required this.limiar, required this.produtos});

  factory EstoqueCriticoDashboard.fromJson(Map<String, dynamic> json) {
    return EstoqueCriticoDashboard(
      limiar: json['limiar'] as int,
      produtos: (json['produtos'] as List)
          .cast<Map<String, dynamic>>()
          .map(ProdutoEstoqueCritico.fromJson)
          .toList(),
    );
  }

  final int limiar;
  final List<ProdutoEstoqueCritico> produtos;
}
