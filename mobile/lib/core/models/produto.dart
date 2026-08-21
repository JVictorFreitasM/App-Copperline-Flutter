/// Mesmo shape de `backend/src/produtos/dto/produto-response.dto.ts` -
/// duplicado aqui por não haver pacote compartilhado entre mobile e back
/// (mesmo padrão já usado no web, `frontend/src/lib/produtos.ts`).
class ProdutoResumo {
  const ProdutoResumo({
    required this.id,
    required this.codigo,
    required this.nome,
    required this.tipo,
    required this.inativo,
    required this.precoVenda,
    required this.gtin,
  });

  factory ProdutoResumo.fromJson(Map<String, dynamic> json) {
    return ProdutoResumo(
      id: json['id'] as String,
      codigo: json['codigo'] as String?,
      nome: json['nome'] as String?,
      tipo: json['tipo'] as String?,
      inativo: json['inativo'] as bool,
      precoVenda: json['precoVenda'] as String?,
      gtin: json['gtin'] as String?,
    );
  }

  final String id;
  final String? codigo;
  final String? nome;
  final String? tipo;
  final bool inativo;
  final String? precoVenda;
  final String? gtin;

  String get titulo => nome ?? codigo ?? '—';
}

class ProdutoDetalhe extends ProdutoResumo {
  const ProdutoDetalhe({
    required super.id,
    required super.codigo,
    required super.nome,
    required super.tipo,
    required super.inativo,
    required super.precoVenda,
    required super.gtin,
    required this.idGrade1,
    required this.idGrade2,
    required this.idGrade3,
  });

  factory ProdutoDetalhe.fromJson(Map<String, dynamic> json) {
    return ProdutoDetalhe(
      id: json['id'] as String,
      codigo: json['codigo'] as String?,
      nome: json['nome'] as String?,
      tipo: json['tipo'] as String?,
      inativo: json['inativo'] as bool,
      precoVenda: json['precoVenda'] as String?,
      gtin: json['gtin'] as String?,
      idGrade1: json['idGrade1'] as String?,
      idGrade2: json['idGrade2'] as String?,
      idGrade3: json['idGrade3'] as String?,
    );
  }

  final String? idGrade1;
  final String? idGrade2;
  final String? idGrade3;

  bool get temGrade => idGrade1 != null || idGrade2 != null || idGrade3 != null;
}

// Valores possíveis vêm do enum TipoProduto do backend (schema.prisma) -
// mesmo mapa de frontend/src/lib/produtos.ts.
const _rotulosTipo = {
  'PROPRIO': 'Próprio',
  'TERCEIROS': 'Terceiros',
  'KIT': 'Kit',
  'CLASSE': 'Classe',
  'INVALIDO': 'Inválido',
};

String rotuloTipoProduto(String? tipo) {
  if (tipo == null) return '—';
  return _rotulosTipo[tipo] ?? tipo;
}
