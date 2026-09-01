import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/auth/auth_notifier.dart';
import '../core/providers/offline_provider.dart';
import '../core/push/push_service.dart';
import '../core/rastreio/rastreio_config.dart';
import '../core/rastreio/rastreio_service.dart';
import 'login_screen.dart';
import 'shell/app_shell.dart';

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

        // Snapshot inicial + escuta de conectividade (OS-MOBILE-22) -
        // mesma condicao de "acabou de logar" do push acima. baixar() so'
        // falha se a PRIMEIRA sincronizacao acontecer sem rede nenhuma -
        // aceitavel (proxima reconexao tenta de novo via
        // OfflineSyncNotifier, que so cobre a FILA de acoes pendentes, nao
        // o snapshot em si - reforcar o snapshot fica a cargo de um pull-
        // to-refresh nas telas, fora de escopo re-tentar sozinho aqui).
        ref.read(snapshotServiceProvider.future).then((servico) => servico.baixar());
        ref.read(offlineSyncNotifierProvider);

        // Retoma o rastreio automaticamente (OS-MOBILE-20) se o usuario
        // tinha deixado ligado antes de fechar o app - "ativo" persistido
        // reflete so a INTENCAO (ver rastreio_config.dart), o Timer em si
        // sempre comeca zerado a cada abertura do app.
        ref.read(rastreioConfigProvider.future).then((config) {
          if (config.ativo) {
            ref.read(rastreioNotifierProvider.notifier).iniciar(config.intervaloMinutos);
          }
        });
      }
    });

    return auth.when(
      data: (estado) =>
          estado.autenticado ? const AppShell() : const LoginScreen(),
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
