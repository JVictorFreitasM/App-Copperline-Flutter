import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/push/push_config.dart';
import '../theme/app_colors.dart';
import '../widgets/app_card.dart';
import '../widgets/listagem_feedback.dart';

/// Tela simples de configuração de notificações (OS-MOBILE-16, critério
/// de aceite explícito) - liga/desliga por categoria, persistido
/// localmente (ver push_config.dart). Só controla o banner de FOREGROUND;
/// aviso explícito na tela sobre a limitação de background/terminado
/// (SO mostra a notificação antes de qualquer código Dart rodar).
class NotificacoesConfigScreen extends ConsumerWidget {
  const NotificacoesConfigScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(pushConfigProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Notificações')),
      body: SafeArea(
        child: config.when(
          data: (categorias) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              AppCard(
                child: Text(
                  'Desligar uma categoria aqui só afeta o aviso mostrado com o '
                  'app aberto. Com o app em segundo plano ou fechado, o '
                  'sistema operacional continua mostrando a notificação '
                  'normalmente.',
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ),
              const SizedBox(height: 16),
              for (final categoria in CategoriaNotificacao.values) ...[
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(categoria.rotulo),
                  value: categorias[categoria] ?? true,
                  activeThumbColor: AppColors.primary,
                  onChanged: (valor) =>
                      ref.read(pushConfigProvider.notifier).definir(categoria, valor),
                ),
              ],
            ],
          ),
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (erro, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: ErroConexao(mensagem: erro.toString()),
          ),
        ),
      ),
    );
  }
}
