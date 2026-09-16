/// Mesmo shape de `backend/src/pagamento/dto/pagamento-response.dto.ts` -
/// duplicado aqui por não haver pacote compartilhado entre mobile e back
/// (mesmo padrão já usado em outros models). Catálogos sincronizados do WK
/// Radar (ver sync/strategies/forma-pagamento.sync.ts e
/// condicao-pagamento.sync.ts) - só as ativas/vigentes já vêm filtradas
/// pelo backend (PagamentoService), sem filtro extra necessário aqui.
class FormaPagamento {
  const FormaPagamento({required this.id, required this.codigo, required this.descricao});

  factory FormaPagamento.fromJson(Map<String, dynamic> json) {
    return FormaPagamento(
      id: json['id'] as String,
      codigo: json['codigo'] as String?,
      descricao: json['descricao'] as String?,
    );
  }

  final String id;
  final String? codigo;
  final String? descricao;

  String get titulo => descricao ?? codigo ?? '—';
}

class CondicaoPagamento {
  const CondicaoPagamento({required this.id, required this.codigo, required this.nome});

  factory CondicaoPagamento.fromJson(Map<String, dynamic> json) {
    return CondicaoPagamento(
      id: json['id'] as String,
      codigo: json['codigo'] as String?,
      nome: json['nome'] as String?,
    );
  }

  final String id;
  final String? codigo;
  final String? nome;

  String get titulo => nome ?? codigo ?? '—';
}
