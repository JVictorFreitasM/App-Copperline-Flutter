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
  const ResultadoEstoque({required this.produtoId, required this.codigo, required this.itens});

  factory ResultadoEstoque.fromJson(Map<String, dynamic> json) {
    return ResultadoEstoque(
      produtoId: json['produtoId'] as String,
      codigo: json['codigo'] as String,
      itens: (json['itens'] as List)
          .cast<Map<String, dynamic>>()
          .map(EstoqueItem.fromJson)
          .toList(),
    );
  }

  final String produtoId;
  final String codigo;
  final List<EstoqueItem> itens;
}
