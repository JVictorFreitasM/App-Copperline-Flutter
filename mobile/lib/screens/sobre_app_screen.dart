import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/providers/atualizacao_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_card.dart';

/// "Sobre o app": versão instalada e as notas dela (o que há de novo), mais um
/// botão pra conferir se existe versão nova. Se existir, o gate de atualização
/// assume a tela sozinho (a atualização é obrigatória).
class SobreAppScreen extends ConsumerStatefulWidget {
  const SobreAppScreen({super.key});

  @override
  ConsumerState<SobreAppScreen> createState() => _SobreAppScreenState();
}

class _SobreAppScreenState extends ConsumerState<SobreAppScreen> {
  bool _conferindo = false;

  Future<void> _conferirAtualizacao() async {
    setState(() => _conferindo = true);
    ref.invalidate(atualizacaoAppProvider);
    final nova = await ref.read(atualizacaoAppProvider.future);
    if (!mounted) return;
    setState(() => _conferindo = false);
    if (nova == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Você já está na versão mais recente.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final info = ref.watch(infoDoAppProvider);
    final notas = ref.watch(notasDaVersaoInstaladaProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Sobre o app')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Copperline', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  info.when(
                    loading: () => const Text('Versão...', style: TextStyle(color: AppColors.muted)),
                    error: (_, _) => const Text('Versão indisponível', style: TextStyle(color: AppColors.muted)),
                    data: (dados) => Text(
                      'Versão ${dados.version} (build ${dados.buildNumber})',
                      style: const TextStyle(color: AppColors.muted),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Novidades desta versão', style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  notas.when(
                    loading: () => const LinearProgressIndicator(),
                    error: (_, _) => const Text('Notas indisponíveis.', style: TextStyle(color: AppColors.muted)),
                    data: (dados) => Text(
                      dados != null && dados.temTexto ? dados.notas : 'Sem notas para esta versão.',
                      style: TextStyle(color: dados != null && dados.temTexto ? null : AppColors.muted),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: _conferindo ? null : _conferirAtualizacao,
              icon: const Icon(Icons.system_update_alt, size: 18),
              label: Text(_conferindo ? 'Conferindo...' : 'Verificar atualização'),
            ),
          ],
        ),
      ),
    );
  }
}
