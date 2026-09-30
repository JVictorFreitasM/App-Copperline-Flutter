/// Mesmo shape de `backend/src/metas/ranking-equipe.service.ts`
/// (RankingEquipeItemDto, GET /equipe/ranking) - duplicado aqui por não
/// haver pacote compartilhado entre mobile e back (mesmo padrão do web,
/// `frontend/src/lib/metas.ts`). Já vem ordenado desc por valorVendido do
/// backend - mobile não reordena.
class RankingEquipeItem {
  const RankingEquipeItem({required this.vendedorId, required this.nome, required this.valorVendido});

  factory RankingEquipeItem.fromJson(Map<String, dynamic> json) {
    return RankingEquipeItem(
      vendedorId: json['vendedorId'] as String,
      nome: json['nome'] as String?,
      valorVendido: (json['valorVendido'] as num).toDouble(),
    );
  }

  final String vendedorId;
  final String? nome;
  final double valorVendido;
}
