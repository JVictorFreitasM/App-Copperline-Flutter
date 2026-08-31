import 'package:geolocator/geolocator.dart';

/// Permissão de localização negada (ou negada permanentemente) - tratada
/// separada de outras falhas de GPS pra a UI mostrar uma mensagem
/// específica em vez de um erro genérico (ver cliente_detalhe_screen.dart,
/// OS-MOBILE-21).
class PermissaoLocalizacaoNegadaException implements Exception {}

/// Posição atual do dispositivo, pedindo permissão se necessário - mesmo
/// padrão já usado em RastreioNotifier.solicitarPermissao
/// (core/rastreio/rastreio_service.dart, OS-MOBILE-20), reaproveitado para
/// check-in/checkout de visita e definição do "pin" do cliente
/// (OS-MOBILE-21).
Future<Position> obterPosicaoAtual() async {
  var permissao = await Geolocator.checkPermission();
  if (permissao == LocationPermission.denied) {
    permissao = await Geolocator.requestPermission();
  }
  if (permissao == LocationPermission.denied || permissao == LocationPermission.deniedForever) {
    throw PermissaoLocalizacaoNegadaException();
  }
  return Geolocator.getCurrentPosition(
    locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
  );
}
