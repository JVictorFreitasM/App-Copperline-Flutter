/// Mesmo shape de `backend/src/estoque/dto/estoque-response.dto.ts` -
/// duplicado aqui por não haver pacote compartilhado entre mobile e back.
class EstoqueItem {
  const EstoqueItem({
    required this.localCodigo,
    required this.localNome,
    required this.lote,
    required this.fabricadoEm,
    required this.quantidade,
  });

  factory EstoqueItem.fromJson(Map<String, dynamic> json) {
    return EstoqueItem(
      localCodigo: json['localCodigo'] as String?,
      localNome: json['localNome'] as String?,
      lote: json['lote'] as String?,
      fabricadoEm: json['fabricadoEm'] as String?,
      quantidade: json['quantidade'] as String,
    );
  }

  final String? localCodigo;
  final String? localNome;
  final String? lote;
  final String? fabricadoEm;
  final String quantidade;

  String get tituloLocal => localNome ?? localCodigo ?? 'Local não identificado';
}

class ResultadoEstoque {
  const ResultadoEstoque({
    required this.produtoId,
    required this.codigo,
    required this.itens,
    required this.quantidadeFisicaTotal,
    required this.quantidadeDisponivel,
    required this.atualizadoEm,
  });

  factory ResultadoEstoque.fromJson(Map<String, dynamic> json) {
    return ResultadoEstoque(
      produtoId: json['produtoId'] as String,
      codigo: json['codigo'] as String,
      itens: (json['itens'] as List)
          .cast<Map<String, dynamic>>()
          .map(EstoqueItem.fromJson)
          .toList(),
      quantidadeFisicaTotal: json['quantidadeFisicaTotal'] as String?,
      quantidadeDisponivel: json['quantidadeDisponivel'] as String?,
      atualizadoEm: json['atualizadoEm'] as String?,
    );
  }

  final String produtoId;
  final String codigo;
  // Lotes reais por local de estocagem (consulta pontual, tempo real) -
  // sempre vazio quando este resultado vem do snapshot offline (ver
  // MobileSnapshotService, backend) - buscar lote produto por produto nao
  // escala pro volume do snapshot.
  final List<EstoqueItem> itens;
  // Soma de itens[].quantidade - null quando itens esta vazio (nao
  // inventar soma sem os lotes reais).
  final String? quantidadeFisicaTotal;
  // Saldo liquido de pedido comprometido em aberto - metrica DIFERENTE de
  // quantidadeFisicaTotal, pode ser bem menor (ou negativa). Null quando o
  // produto existe mas nunca teve saldo sincronizado.
  final String? quantidadeDisponivel;
  // Momento da ultima sincronizacao de quantidadeDisponivel (nao da
  // consulta em si) - null quando nunca sincronizado.
  final String? atualizadoEm;
}

/// Mesmo shape de `backend/src/estoque/dto/estoque-mais-pedidos.dto.ts`
/// (ProdutoMaisPedidoDto, GET /estoque/mais-pedidos) - ranking por
/// quantidade total pedida (nao valor), pra priorizar reposicao.
class ProdutoMaisPedido {
  const ProdutoMaisPedido({
    required this.produtoId,
    required this.nome,
    required this.codigo,
    required this.quantidadeTotalPedida,
    required this.quantidadeDisponivel,
  });

  factory ProdutoMaisPedido.fromJson(Map<String, dynamic> json) {
    return ProdutoMaisPedido(
      produtoId: json['produtoId'] as String,
      nome: json['nome'] as String?,
      codigo: json['codigo'] as String,
      quantidadeTotalPedida: (json['quantidadeTotalPedida'] as num).toDouble(),
      quantidadeDisponivel: json['quantidadeDisponivel'] as String?,
    );
  }

  final String produtoId;
  final String? nome;
  final String codigo;
  final double quantidadeTotalPedida;
  final String? quantidadeDisponivel;

  String get titulo => nome ?? codigo;
}
