import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/auth/auth_notifier.dart';
import '../core/push/push_service.dart';
import 'home_screen.dart';
import 'login_screen.dart';

/// Raiz de navegação (OS-MOBILE-12) - decide entre [LoginScreen] e
/// [HomeScreen] com base no [authProvider], mesmo papel do `proxy.ts` +
/// `exigirUsuarioAutenticado()` no frontend web, só que como widget em vez
/// de middleware de rota (não há rotas HTTP num app nativo).
class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);

    // Registro de token de push (OS-MOBILE-16) uma vez por transição
    // pra "autenticado" (login concluído, ou sessão já válida ao abrir o
    // app) - POST /dispositivos exige sessão (usuário resolvido via
    // @CurrentUser() no backend), por isso só dispara aqui, nunca antes.
    ref.listen(authProvider, (anterior, atual) {
      final ficouAutenticado = atual.value?.autenticado ?? false;
      final jaEstavaAutenticado = anterior?.value?.autenticado ?? false;
      if (ficouAutenticado && !jaEstavaAutenticado) {
        ref.read(pushServiceProvider).inicializar();
      }
    });

    return auth.when(
      data: (estado) =>
          estado.autenticado ? const HomeScreen() : const LoginScreen(),
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (erro, _) => Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Erro ao verificar sessão: $erro'),
          ),
        ),
      ),
    );
  }
}
