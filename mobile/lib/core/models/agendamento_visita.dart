/// Mesmo shape de
/// `backend/src/visitas/dto/agendamento-visita-response.dto.ts`
/// (AgendamentoVisitaDto) - duplicado aqui por não haver pacote
/// compartilhado entre mobile e back (OS-novas-implementacoes.md Bloco 5).
class AgendamentoVisita {
  const AgendamentoVisita({
    required this.id,
    required this.clienteId,
    required this.vendedorId,
    required this.dataHoraPrevista,
    required this.criadoEm,
  });

  factory AgendamentoVisita.fromJson(Map<String, dynamic> json) {
    return AgendamentoVisita(
      id: json['id'] as String,
      clienteId: json['clienteId'] as String,
      vendedorId: json['vendedorId'] as String,
      dataHoraPrevista: DateTime.parse(json['dataHoraPrevista'] as String),
      criadoEm: DateTime.parse(json['criadoEm'] as String),
    );
  }

  final String id;
  final String clienteId;
  final String vendedorId;
  final DateTime dataHoraPrevista;
  final DateTime criadoEm;
}
