import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../local_db/acao_pendente.dart';
import '../providers/offline_provider.dart';

/// Captura periódica de posição com o app aberto ou em segundo plano
/// ENQUANTO O PROCESSO CONTINUA VIVO (OS-MOBILE-20) - NÃO cobre app
/// fechado/removido da lista de recentes (decisão confirmada com o
/// usuário: isso exigiria um foreground service nativo + permissão
/// "Always" no Android/iOS, escopo maior que esta OS). Cada ponto
/// capturado vira uma ação RASTREIO_LOTE na fila offline (ver
/// FilaPendenteService, OS-MOBILE-22) - nunca perde ponto por falta de
/// rede, só espera a próxima sincronização.
class RastreioNotifier extends Notifier<bool> {
  Timer? _timer;

  @override
  bool build() {
    ref.onDispose(() => _timer?.cancel());
    return false;
  }

  Future<LocationPermission> solicitarPermissao() async {
    var permissao = await Geolocator.checkPermission();
    if (permissao == LocationPermission.denied) {
      permissao = await Geolocator.requestPermission();
    }
    return permissao;
  }

  bool get _timerAtivo => _timer != null;

  Future<void> iniciar(int intervaloMinutos) async {
    if (_timerAtivo) {
      _timer!.cancel();
    }

    final permissao = await solicitarPermissao();
    if (permissao == LocationPermission.denied ||
        permissao == LocationPermission.deniedForever) {
      state = false;
      return;
    }

    state = true;
    // Captura um ponto imediatamente ao ligar (nao espera o primeiro
    // intervalo inteiro pra ter o primeiro dado do dia), depois periodico.
    unawaited(_capturarPonto());
    _timer = Timer.periodic(
      Duration(minutes: intervaloMinutos),
      (_) => _capturarPonto(),
    );
  }

  void parar() {
    _timer?.cancel();
    _timer = null;
    state = false;
  }

  Future<void> _capturarPonto() async {
    try {
      final posicao = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      final fila = await ref.read(filaPendenteServiceProvider.future);
      await fila.enfileirar(
        tipo: TipoAcaoFila.rastreioLote,
        timestamp: posicao.timestamp,
        payload: {
          'pontos': [
            {
              'latitude': posicao.latitude,
              'longitude': posicao.longitude,
              'timestamp': posicao.timestamp.toIso8601String(),
            },
          ],
        },
      );
      ref.invalidate(contagemPendentesProvider);
    } catch (_) {
      // Falha pontual de GPS (sem sinal, timeout) - so pula esta captura,
      // a proxima tentativa e' automatica no proximo intervalo (nao ha
      // erro pra mostrar pro usuario aqui, e' um evento silencioso de
      // fundo).
    }
  }
}

final rastreioNotifierProvider = NotifierProvider<RastreioNotifier, bool>(
  RastreioNotifier.new,
);
