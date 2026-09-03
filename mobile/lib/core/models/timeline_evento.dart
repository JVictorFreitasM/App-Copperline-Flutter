/// Mesmo shape de `backend/src/clientes/cliente-timeline.service.ts`
/// (TimelineEvento, GET /clientes/:id/timeline, OS-WEB-42/OS-MOBILE-40) -
/// modelo unico "achatado" (nao uma hierarquia de classes por tipo) com
/// campos opcionais conforme o `tipo`, mesmo padrao ja usado no resto do
/// app pra DTO vindo do backend.
class TimelineEvento {
  const TimelineEvento({
    required this.tipo,
    required this.data,
    this.pedidoNumero,
    this.situacao,
    this.valorTotal,
    this.statusAnterior,
    this.statusNovo,
    this.motivoCancelamento,
    this.notaFiscalNumero,
    this.notaFiscalStatus,
  });

  factory TimelineEvento.fromJson(Map<String, dynamic> json) {
    return TimelineEvento(
      tipo: json['tipo'] as String,
      data: json['data'] as String,
      pedidoNumero: json['numero'] as String?,
      situacao: json['situacao'] as String?,
      valorTotal: json['valorTotal'] as String?,
      statusAnterior: json['statusAnterior'] as String?,
      statusNovo: json['statusNovo'] as String?,
      motivoCancelamento: json['motivo'] as String?,
      notaFiscalNumero: json['tipo'] == 'NOTA_FISCAL' ? '${json['numero']}' : null,
      notaFiscalStatus: json['tipo'] == 'NOTA_FISCAL' ? json['status'] as String? : null,
    );
  }

  final String tipo;
  final String data;
  final String? pedidoNumero;
  final String? situacao;
  final String? valorTotal;
  final String? statusAnterior;
  final String? statusNovo;
  final String? motivoCancelamento;
  final String? notaFiscalNumero;
  final String? notaFiscalStatus;
}
