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

  Future<void> salvarCookie(String cookie) =>
      _storage.write(key: _chaveCookie, value: cookie);

  Future<String?> lerCookie() => _storage.read(key: _chaveCookie);

  Future<void> limpar() => _storage.delete(key: _chaveCookie);
}

final sessionStorageProvider = Provider<SessionStorage>((ref) {
  return const SessionStorage(FlutterSecureStorage());
});
