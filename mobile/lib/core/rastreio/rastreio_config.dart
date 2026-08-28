import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Configuração local de rastreio (OS-MOBILE-20, "intervalo de captura
/// configurável localmente: ex 1, 5, 15 minutos") - persistida via
/// shared_preferences (mesmo padrão de push_config.dart) - o backend não
/// precisa saber disso, é só cadência do device.
const opcoesIntervaloMinutos = [1, 5, 15];
const _intervaloPadraoMinutos = 5;

const _chaveIntervalo = 'rastreio_intervalo_minutos';
const _chaveAtivo = 'rastreio_ativo';

class RastreioConfig {
  const RastreioConfig({required this.intervaloMinutos, required this.ativo});

  final int intervaloMinutos;
  final bool ativo;
}

class RastreioConfigNotifier extends AsyncNotifier<RastreioConfig> {
  @override
  Future<RastreioConfig> build() async {
    final prefs = await SharedPreferences.getInstance();
    return RastreioConfig(
      intervaloMinutos: prefs.getInt(_chaveIntervalo) ?? _intervaloPadraoMinutos,
      // "ativo" persistido só reflete a ÚLTIMA intenção do usuário (ligou/
      // desligou) - quem realmente inicia a captura ao abrir o app é
      // RastreioNotifier (ver rastreio_provider.dart), não este build().
      ativo: prefs.getBool(_chaveAtivo) ?? false,
    );
  }

  Future<void> definirIntervalo(int minutos) async {
    final atual = await future;
    state = AsyncData(RastreioConfig(intervaloMinutos: minutos, ativo: atual.ativo));
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_chaveIntervalo, minutos);
  }

  Future<void> definirAtivo(bool ativo) async {
    final atual = await future;
    state = AsyncData(RastreioConfig(intervaloMinutos: atual.intervaloMinutos, ativo: ativo));
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_chaveAtivo, ativo);
  }
}

final rastreioConfigProvider = AsyncNotifierProvider<RastreioConfigNotifier, RastreioConfig>(
  RastreioConfigNotifier.new,
);
