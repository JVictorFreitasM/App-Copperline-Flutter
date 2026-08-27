import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Favoritos locais por vendedor/dispositivo (OS-MOBILE-15) - "sem
/// endpoint novo nesta fase" (escopo explícito da OS), por isso
/// persistência 100% local via SharedPreferences (não sensível o
/// suficiente pra justificar flutter_secure_storage, que já é reservado
/// pro cookie de sessão - ver session_storage.dart). Duas chaves
/// separadas (cliente/produto) em vez de uma lista mista - mais simples
/// de consultar "isso é favorito?" por tipo sem precisar prefixar/parsear
/// um id composto.
enum TipoFavorito { cliente, produto }

String _chave(TipoFavorito tipo) => switch (tipo) {
  TipoFavorito.cliente => 'favoritos_clientes',
  TipoFavorito.produto => 'favoritos_produtos',
};

class FavoritosNotifier extends AsyncNotifier<Map<TipoFavorito, Set<String>>> {
  @override
  Future<Map<TipoFavorito, Set<String>>> build() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      for (final tipo in TipoFavorito.values)
        tipo: (prefs.getStringList(_chave(tipo)) ?? const []).toSet(),
    };
  }

  bool ehFavorito(TipoFavorito tipo, String id) {
    return state.value?[tipo]?.contains(id) ?? false;
  }

  Future<void> alternar(TipoFavorito tipo, String id) async {
    final atual = await future;
    final favoritosDoTipo = Set<String>.from(atual[tipo] ?? const {});
    if (!favoritosDoTipo.remove(id)) {
      favoritosDoTipo.add(id);
    }

    final novoEstado = {...atual, tipo: favoritosDoTipo};
    state = AsyncData(novoEstado);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_chave(tipo), favoritosDoTipo.toList());
  }
}

final favoritosProvider =
    AsyncNotifierProvider<FavoritosNotifier, Map<TipoFavorito, Set<String>>>(
      FavoritosNotifier.new,
    );
