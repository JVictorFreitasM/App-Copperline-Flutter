import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:copperline_mobile/core/providers/favoritos_provider.dart';

// SharedPreferences.setMockInitialValues (OS-MOBILE-15) - evita depender
// de plugin/platform channel real em teste unitário, mesmo espírito de
// não fazer chamada real em teste automatizado (ver skill flutter-widget).
void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('comeca sem nenhum favorito', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final favoritos = await container.read(favoritosProvider.future);

    expect(favoritos[TipoFavorito.cliente], isEmpty);
    expect(favoritos[TipoFavorito.produto], isEmpty);
  });

  test('alternar adiciona um favorito que nao existia', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    await container.read(favoritosProvider.future);

    await container.read(favoritosProvider.notifier).alternar(TipoFavorito.cliente, 'c1');

    final favoritos = container.read(favoritosProvider).value!;
    expect(favoritos[TipoFavorito.cliente], contains('c1'));
  });

  test('alternar remove um favorito que ja existia (toggle)', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    await container.read(favoritosProvider.future);

    final notifier = container.read(favoritosProvider.notifier);
    await notifier.alternar(TipoFavorito.produto, 'p1');
    await notifier.alternar(TipoFavorito.produto, 'p1');

    final favoritos = container.read(favoritosProvider).value!;
    expect(favoritos[TipoFavorito.produto], isNot(contains('p1')));
  });

  test('favorito persiste entre instancias (simulando reabrir o app)', () async {
    final container1 = ProviderContainer();
    await container1.read(favoritosProvider.future);
    await container1.read(favoritosProvider.notifier).alternar(TipoFavorito.cliente, 'c-persistente');
    container1.dispose();

    // Novo container, mesmo SharedPreferences "em disco" (mock global) -
    // simula reabrir o app numa nova sessao.
    final container2 = ProviderContainer();
    addTearDown(container2.dispose);
    final favoritos = await container2.read(favoritosProvider.future);

    expect(favoritos[TipoFavorito.cliente], contains('c-persistente'));
  });

  test('favoritar cliente nao mexe nos favoritos de produto e vice-versa', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    await container.read(favoritosProvider.future);

    final notifier = container.read(favoritosProvider.notifier);
    await notifier.alternar(TipoFavorito.cliente, 'c1');
    await notifier.alternar(TipoFavorito.produto, 'p1');

    final favoritos = container.read(favoritosProvider).value!;
    expect(favoritos[TipoFavorito.cliente], equals({'c1'}));
    expect(favoritos[TipoFavorito.produto], equals({'p1'}));
  });
}
