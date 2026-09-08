/// Mesmo shape de
/// `backend/src/tabelas-preco/dto/tabela-preco-response.dto.ts`
/// (TabelaPrecoResumoDto) - duplicado aqui por não haver pacote
/// compartilhado entre mobile e back (mesmo padrão já usado no web,
/// `frontend/src/lib/tabelas-preco.ts`).
class TabelaPrecoResumo {
  const TabelaPrecoResumo({
    required this.id,
    required this.codigo,
    required this.ativa,
    required this.padrao,
    required this.quantidadeItens,
    required this.sincronizadoEm,
  });

  factory TabelaPrecoResumo.fromJson(Map<String, dynamic> json) {
    return TabelaPrecoResumo(
      id: json['id'] as String,
      codigo: json['codigo'] as String,
      ativa: json['ativa'] as bool,
      padrao: json['padrao'] as bool,
      quantidadeItens: json['quantidadeItens'] as int,
      sincronizadoEm: json['sincronizadoEm'] as String,
    );
  }

  final String id;
  final String codigo;
  final bool ativa;
  final bool padrao;
  final int quantidadeItens;
  final String sincronizadoEm;
}

class ItemTabelaPreco {
  const ItemTabelaPreco({
    required this.id,
    required this.codigoItem,
    required this.preco,
    required this.precoPromocional,
    required this.dataUltimoReajuste,
  });

  factory ItemTabelaPreco.fromJson(Map<String, dynamic> json) {
    return ItemTabelaPreco(
      id: json['id'] as String,
      codigoItem: json['codigoItem'] as String,
      preco: json['preco'] as String,
      precoPromocional: json['precoPromocional'] as String?,
      dataUltimoReajuste: json['dataUltimoReajuste'] as String?,
    );
  }

  final String id;
  final String codigoItem;
  final String preco;
  final String? precoPromocional;
  final String? dataUltimoReajuste;
}
