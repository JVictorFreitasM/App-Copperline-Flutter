import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_client.dart';
import 'idp_user.dart';
import 'logout_service.dart';
import 'session_storage.dart';

class AuthState {
  const AuthState({required this.usuario});

  final IdpUser? usuario;

  bool get autenticado => usuario != null;
}

/// Estado de autenticação do app - checa se já existe cookie de sessão
/// salvo (dispositivo já logado antes) e valida contra `/auth/me` a cada
/// inicialização, mesmo padrão de `getCurrentUser()` no frontend web
/// (`frontend/src/lib/auth.ts`).
class AuthNotifier extends AsyncNotifier<AuthState> {
  @override
  Future<AuthState> build() async {
    final storage = ref.watch(sessionStorageProvider);
    final cookie = await storage.lerCookie();
    if (cookie == null) {
      return const AuthState(usuario: null);
    }

    final apiClient = ref.watch(apiClientProvider);
    final usuario = await apiClient.obterUsuarioAtual();
    if (usuario == null) {
      // Cookie salvo mas sessão inválida/expirada no backend - limpa pra
      // não ficar tentando de novo a cada rebuild.
      await storage.limpar();
    }
    return AuthState(usuario: usuario);
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
