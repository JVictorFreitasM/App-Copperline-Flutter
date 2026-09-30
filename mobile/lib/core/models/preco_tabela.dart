/// Mesmo shape de `backend/src/tabelas-preco/preco-produto.service.ts`
/// (ProdutoPrecoPorTabelaDto, GET /produtos/:id/precos) - duplicado aqui
/// por não haver pacote compartilhado entre mobile e back (mesmo padrão
/// do web, `frontend/src/app/produtos/[id]/precos-por-tabela.tsx`).
class ProdutoPrecoPorTabela {
  const ProdutoPrecoPorTabela({required this.codigo, required this.preco});

  factory ProdutoPrecoPorTabela.fromJson(Map<String, dynamic> json) {
    return ProdutoPrecoPorTabela(
      codigo: json['codigo'] as String,
      // null = essa tabela não tem item cadastrado pro código do produto.
      preco: json['preco'] as String?,
    );
  }

  final String codigo;
  final String? preco;
}
