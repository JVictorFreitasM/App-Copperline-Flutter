import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import 'idp_user.dart';
import 'logout_service.dart';
import 'session_storage.dart';

class AuthState {
  const AuthState({required this.usuario, this.usandoCacheOffline = false});

  final IdpUser? usuario;

  // OS-MOBILE-38 - true quando este estado veio do cache local (sessão
  // salva, ainda não revalidada contra o servidor nesta abertura do app,
  // ou revalidação em segundo plano falhou por falta de rede). AppShell
  // usa isso pro indicador visual de "modo offline".
  final bool usandoCacheOffline;

  bool get autenticado => usuario != null;
}

// Prazo que uma sessão pode continuar sendo usada offline (dado local, sem
// conseguir revalidar contra o servidor) antes de exigir novo login -
// valor sugerido pela OS-MOBILE-38, ajustável.
const _janelaToleranciaOffline = Duration(days: 7);

/// Estado de autenticação do app - libera a UI IMEDIATAMENTE com o último
/// usuário conhecido (cache local, OS-MOBILE-38) quando existir, sem
/// bloquear esperando resposta de rede; a validação contra `/auth/me`
/// acontece em segundo plano depois. Só bloqueia esperando rede quando não
/// há cache utilizável (primeira vez após instalar, ou janela de
/// tolerância offline vencida) - nesses casos não tem como confiar
/// cegamente no dado local indefinidamente.
class AuthNotifier extends AsyncNotifier<AuthState> {
  @override
  Future<AuthState> build() async {
    final storage = ref.watch(sessionStorageProvider);
    final cookie = await storage.lerCookie();
    if (cookie == null) {
      return const AuthState(usuario: null);
    }

    final usuarioCacheJson = await storage.lerUsuarioCache();
    if (usuarioCacheJson != null) {
      final validadoEm = await storage.lerValidadoEm();
      final toleranciaVencida =
          validadoEm == null ||
          DateTime.now().difference(validadoEm) > _janelaToleranciaOffline;

      if (!toleranciaVencida) {
        // Libera a tela com o cache AGORA, revalida em paralelo (não
        // aguardado - nunca bloqueia a UI liberada aqui).
        unawaited(_revalidarEmSegundoPlano());
        final usuarioCache = IdpUser.fromJson(
          jsonDecode(usuarioCacheJson) as Map<String, dynamic>,
        );
        return AuthState(usuario: usuarioCache, usandoCacheOffline: true);
      }
      // Tolerância vencida - cai pro fluxo abaixo (precisa confirmar com
      // o servidor antes de liberar, não dá mais pra confiar só no cache).
    }

    return _validarContraServidor(storage);
  }

  // Único caminho que de fato fala com o servidor pra decidir o estado -
  // usado tanto na ausência de cache quanto na tolerância vencida.
  // DioException (falha de rede) é diferente de obterUsuarioAtual()
  // devolver null (servidor confirmou que a sessão não é válida, ver
  // api_client.dart) - só o segundo caso é tratado como "sessão inválida
  // de verdade" (limpa o cache); falha de rede sem cache utilizável não
  // tem como ser distinguida de sessão inválida, então cai pro login mesmo
  // (mesmo comportamento de antes desta OS).
  Future<AuthState> _validarContraServidor(SessionStorage storage) async {
    final apiClient = ref.watch(apiClientProvider);
    IdpUser? usuario;
    try {
      usuario = await apiClient.obterUsuarioAtual();
    } on DioException {
      usuario = null;
    }

    if (usuario == null) {
      await storage.limpar();
    } else {
      await storage.salvarUsuarioCache(jsonEncode(usuario.toJson()));
      await storage.salvarValidadoEm(DateTime.now());
    }
    return AuthState(usuario: usuario);
  }

  Future<void> _revalidarEmSegundoPlano() async {
    final storage = ref.read(sessionStorageProvider);
    final apiClient = ref.read(apiClientProvider);
    IdpUser? usuario;
    try {
      usuario = await apiClient.obterUsuarioAtual();
    } on DioException {
      // Sem rede pra revalidar - mantém o estado vindo do cache como
      // está (já é usandoCacheOffline: true), tenta de novo na próxima
      // abertura do app.
      return;
    }

    if (usuario == null) {
      // Servidor confirmou que a sessão não é mais válida (não é falha de
      // rede) - só agora desloga de verdade.
      await storage.limpar();
      // ref.mounted: o provider pode ter sido descartado enquanto essa
      // chamada de rede estava em voo (ex: logout manual nesse meio-tempo)
      // - escrever em `state` depois de descartado lança em runtime.
      if (ref.mounted) {
        state = const AsyncData(AuthState(usuario: null));
      }
      return;
    }

    await storage.salvarUsuarioCache(jsonEncode(usuario.toJson()));
    await storage.salvarValidadoEm(DateTime.now());
    if (ref.mounted) {
      state = AsyncData(AuthState(usuario: usuario));
    }
  }

  /// Chamado pela LoginScreen quando a WebView detecta que o login
  /// terminou e o cookie de sessão foi capturado.
  Future<void> loginConcluido(String cookie) async {
    final storage = ref.read(sessionStorageProvider);
    await storage.salvarCookie(cookie);
    ref.invalidateSelf();
    await future;
  }

  Future<void> logout() async {
    final storage = ref.read(sessionStorageProvider);
    final logoutService = ref.read(logoutServiceProvider);

    try {
      await logoutService.encerrarSessaoNoServidor();
    } finally {
      // Limpa o cookie local mesmo se o logout no servidor falhar - melhor
      // esforço, não deixa o usuário preso na tela logada por causa disso.
      await storage.limpar();
      state = const AsyncData(AuthState(usuario: null));
    }
  }
}

final authProvider = AsyncNotifierProvider<AuthNotifier, AuthState>(
  AuthNotifier.new,
);
