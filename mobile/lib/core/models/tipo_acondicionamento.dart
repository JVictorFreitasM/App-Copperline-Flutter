/// Mesmo shape de `backend/src/tipos-acondicionamento/dto/
/// tipo-acondicionamento-response.dto.ts` (TipoAcondicionamentoDto,
/// GET /tipos-acondicionamento) - duplicado aqui por não haver pacote
/// compartilhado entre mobile e back.
class TipoAcondicionamento {
  const TipoAcondicionamento({required this.id, required this.nome, required this.tamanhoPadrao});

  factory TipoAcondicionamento.fromJson(Map<String, dynamic> json) {
    return TipoAcondicionamento(
      id: json['id'] as String,
      nome: json['nome'] as String,
      // null = retalho (corte fracionário livre); preenchido = tamanho
      // fixo, pedido tem que ser múltiplo exato (ver backend,
      // domain/calculo-quantidade-pedido.ts).
      tamanhoPadrao: json['tamanhoPadrao'] as String?,
    );
  }

  final String id;
  final String nome;
  final String? tamanhoPadrao;

  String get descricao => tamanhoPadrao != null ? '$nome ($tamanhoPadrao m)' : nome;
}
