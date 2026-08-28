import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../core/rastreio/rastreio_config.dart';
import '../core/rastreio/rastreio_service.dart';
import '../theme/app_colors.dart';
import '../widgets/app_card.dart';
import '../widgets/listagem_feedback.dart';

/// Tela de configuração do rastreio (OS-MOBILE-20) - liga/desliga +
/// intervalo de captura. Explicação clara do motivo ANTES de pedir
/// permissão (critério de aceite explícito da OS) - o texto abaixo
/// aparece sempre, não só na hora do pedido de permissão do SO.
class RastreioConfigScreen extends ConsumerWidget {
  const RastreioConfigScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(rastreioConfigProvider);
    final capturandoAgora = ref.watch(rastreioNotifierProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Rastreio')),
      body: SafeArea(
        child: config.when(
          data: (dados) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              AppCard(
                child: Text(
                  'Compartilha sua localização periodicamente com o supervisor '
                  'enquanto o app estiver aberto ou em segundo plano, pra '
                  'acompanhar o roteiro da equipe em campo. Só funciona com o '
                  'app ainda em execução - se você fechar o app completamente, '
                  'a captura para até você abrir de novo.',
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ),
              const SizedBox(height: 16),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Rastreio ativo'),
                subtitle: Text(capturandoAgora ? 'Capturando agora' : 'Desligado'),
                value: dados.ativo,
                activeThumbColor: AppColors.primary,
                onChanged: (valor) => _alternar(ref, context, valor, dados.intervaloMinutos),
              ),
              const SizedBox(height: 16),
              Text('Intervalo de captura', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  for (final minutos in opcoesIntervaloMinutos)
                    ChoiceChip(
                      label: Text('$minutos min'),
                      selected: dados.intervaloMinutos == minutos,
                      onSelected: (selecionado) async {
                        if (!selecionado) return;
                        await ref.read(rastreioConfigProvider.notifier).definirIntervalo(minutos);
                        if (dados.ativo) {
                          await ref.read(rastreioNotifierProvider.notifier).iniciar(minutos);
                        }
                      },
                    ),
                ],
              ),
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

  Future<void> _alternar(
    WidgetRef ref,
    BuildContext context,
    bool ligar,
    int intervaloMinutos,
  ) async {
    final configNotifier = ref.read(rastreioConfigProvider.notifier);
    final rastreioNotifier = ref.read(rastreioNotifierProvider.notifier);

    if (!ligar) {
      rastreioNotifier.parar();
      await configNotifier.definirAtivo(false);
      return;
    }

    final permissao = await rastreioNotifier.solicitarPermissao();
    if (permissao == LocationPermission.denied ||
        permissao == LocationPermission.deniedForever) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Permissão de localização negada - não é possível ativar o rastreio.'),
          ),
        );
      }
      return;
    }

    await rastreioNotifier.iniciar(intervaloMinutos);
    await configNotifier.definirAtivo(true);
  }
}
