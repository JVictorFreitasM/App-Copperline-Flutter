import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// Cookie de sessão guardado em local seguro do dispositivo (Keystore/
// Keychain via flutter_secure_storage), nunca em SharedPreferences puro -
// ver skill design-system, seção "Aplicação no Mobile"/segurança. É o
// mesmo cookie httpOnly que o navegador guardaria no fluxo web
// (connect.sid) - o app só o repassa nas próprias chamadas via Dio, nunca
// interpreta ou decodifica o conteúdo dele.
class SessionStorage {
  const SessionStorage(this._storage);

  final FlutterSecureStorage _storage;

  static const _chaveCookie = 'session_cookie';
  // OS-MOBILE-38 (inicialização offline-first) - último IdpUser conhecido
  // (JSON) e quando foi confirmado de verdade contra o servidor pela
  // última vez, pra liberar a UI com dado local sem bloquear esperando
  // rede, e pra decidir quando a janela de tolerância offline vence.
  static const _chaveUsuarioCache = 'usuario_cache';
  static const _chaveValidadoEm = 'sessao_validada_em';

  Future<void> salvarCookie(String cookie) =>
      _storage.write(key: _chaveCookie, value: cookie);

  Future<String?> lerCookie() => _storage.read(key: _chaveCookie);

  Future<void> salvarUsuarioCache(String usuarioJson) =>
      _storage.write(key: _chaveUsuarioCache, value: usuarioJson);

  Future<String?> lerUsuarioCache() => _storage.read(key: _chaveUsuarioCache);

  Future<void> salvarValidadoEm(DateTime data) =>
      _storage.write(key: _chaveValidadoEm, value: data.toIso8601String());

  Future<DateTime?> lerValidadoEm() async {
    final valor = await _storage.read(key: _chaveValidadoEm);
    if (valor == null) return null;
    return DateTime.tryParse(valor);
  }

  Future<void> limpar() => Future.wait([
    _storage.delete(key: _chaveCookie),
    _storage.delete(key: _chaveUsuarioCache),
    _storage.delete(key: _chaveValidadoEm),
  ]);
}

final sessionStorageProvider = Provider<SessionStorage>((ref) {
  return const SessionStorage(FlutterSecureStorage());
});
