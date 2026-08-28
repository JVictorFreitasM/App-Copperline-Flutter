import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:copperline_mobile/core/rastreio/rastreio_config.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('comeca desligado, com intervalo padrao de 5 minutos', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final config = await container.read(rastreioConfigProvider.future);

    expect(config.ativo, false);
    expect(config.intervaloMinutos, 5);
  });

  test('definirAtivo persiste entre instancias (simulando reabrir o app)', () async {
    final container1 = ProviderContainer();
    await container1.read(rastreioConfigProvider.future);
    await container1.read(rastreioConfigProvider.notifier).definirAtivo(true);
    container1.dispose();

    final container2 = ProviderContainer();
    addTearDown(container2.dispose);
    final config = await container2.read(rastreioConfigProvider.future);

    expect(config.ativo, true);
  });

  test('definirIntervalo persiste o valor escolhido', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    await container.read(rastreioConfigProvider.future);

    await container.read(rastreioConfigProvider.notifier).definirIntervalo(15);

    final config = container.read(rastreioConfigProvider).value!;
    expect(config.intervaloMinutos, 15);
  });
}
