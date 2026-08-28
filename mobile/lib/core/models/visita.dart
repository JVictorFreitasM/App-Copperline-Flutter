/// Mesmo shape de `backend/src/visitas/dto/visita-response.dto.ts`
/// (VisitaDto) - duplicado aqui por não haver pacote compartilhado entre
/// mobile e back (mesmo padrão já usado nos demais modelos).
class Visita {
  const Visita({
    required this.id,
    required this.clienteId,
    required this.vendedorId,
    required this.checkinEm,
    required this.checkinLat,
    required this.checkinLng,
    required this.checkoutEm,
    required this.checkoutLat,
    required this.checkoutLng,
    required this.nota,
    required this.canceladaEm,
    required this.motivoCancelamento,
    required this.temFoto,
    required this.distanciaCheckinMetros,
    required this.distanciaCheckoutMetros,
  });

  factory Visita.fromJson(Map<String, dynamic> json) {
    return Visita(
      id: json['id'] as String,
      clienteId: json['clienteId'] as String,
      vendedorId: json['vendedorId'] as String,
      checkinEm: json['checkinEm'] as String,
      checkinLat: (json['checkinLat'] as num).toDouble(),
      checkinLng: (json['checkinLng'] as num).toDouble(),
      checkoutEm: json['checkoutEm'] as String?,
      checkoutLat: (json['checkoutLat'] as num?)?.toDouble(),
      checkoutLng: (json['checkoutLng'] as num?)?.toDouble(),
      nota: json['nota'] as String?,
      canceladaEm: json['canceladaEm'] as String?,
      motivoCancelamento: json['motivoCancelamento'] as String?,
      temFoto: json['temFoto'] as bool,
      distanciaCheckinMetros: (json['distanciaCheckinMetros'] as num?)?.toDouble(),
      distanciaCheckoutMetros: (json['distanciaCheckoutMetros'] as num?)?.toDouble(),
    );
  }

  final String id;
  final String clienteId;
  final String vendedorId;
  final String checkinEm;
  final double checkinLat;
  final double checkinLng;
  final String? checkoutEm;
  final double? checkoutLat;
  final double? checkoutLng;
  final String? nota;
  final String? canceladaEm;
  final String? motivoCancelamento;
  final bool temFoto;
  final double? distanciaCheckinMetros;
  final double? distanciaCheckoutMetros;

  bool get cancelada => canceladaEm != null;
  bool get emAndamento => !cancelada && checkoutEm == null;
}
