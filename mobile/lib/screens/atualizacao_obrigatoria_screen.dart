import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/atualizacao/atualizacao_app.dart';
import '../core/providers/atualizacao_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_card.dart';

/// Tela que BLOQUEIA o app enquanto houver uma versão mais nova publicada: sem
/// "agora não" nem voltar - o usuário atualiza pra continuar (novas
/// funcionalidades e correções de bugs). Baixa o APK do próprio backend (só
/// depois do login) e abre o instalador do Android, onde o usuário confirma.
class AtualizacaoObrigatoriaScreen extends ConsumerStatefulWidget {
  const AtualizacaoObrigatoriaScreen({super.key, required this.atualizacao});

  final AtualizacaoApp atualizacao;

  @override
  ConsumerState<AtualizacaoObrigatoriaScreen> createState() =>
      _AtualizacaoObrigatoriaScreenState();
}

class _AtualizacaoObrigatoriaScreenState extends ConsumerState<AtualizacaoObrigatoriaScreen> {
  bool _baixando = false;
  double _progresso = 0;
  String? _erro;

  Future<void> _atualizar() async {
    if (_baixando) return;
    setState(() {
      _baixando = true;
      _progresso = 0;
      _erro = null;
    });
    try {
      await ref.read(atualizacaoAppServiceProvider).baixarEInstalar(
        widget.atualizacao,
        (progresso) {
          if (mounted) setState(() => _progresso = progresso);
        },
      );
      // O instalador do Android assumiu - se o usuário cancelar e voltar, o
      // botão continua disponível.
      if (mounted) setState(() => _baixando = false);
    } catch (erro) {
      if (!mounted) return;
      setState(() {
        _baixando = false;
        _erro = '$erro'.replaceFirst('Bad state: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final atualizacao = widget.atualizacao;
    return PopScope(
      canPop: false,
      child: Scaffold(
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const SizedBox(height: 24),
              Center(
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: const BoxDecoration(
                    color: AppColors.primaryLight,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.system_update, size: 34, color: AppColors.primary),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Atualização necessária',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 10),
              const Text(
                'Há uma nova versão do app, com novas funcionalidades e correções de bugs. '
                'Atualize para continuar usando.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 20),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Versão ${atualizacao.versionName} (${atualizacao.versionCode}) · '
                      '${atualizacao.tamanhoFormatado}',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    if (atualizacao.notas.trim().isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(atualizacao.notas, style: const TextStyle(fontSize: 13)),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 20),
              if (_baixando) ...[
                LinearProgressIndicator(value: _progresso > 0 ? _progresso : null),
                const SizedBox(height: 6),
                Text(
                  _progresso > 0 ? 'Baixando... ${(_progresso * 100).round()}%' : 'Baixando...',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ] else
                FilledButton.icon(
                  onPressed: _atualizar,
                  icon: const Icon(Icons.download),
                  label: Text(_erro == null ? 'Atualizar agora' : 'Tentar novamente'),
                ),
              if (_erro != null) ...[
                const SizedBox(height: 12),
                Text(
                  _erro!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 12, color: AppColors.red),
                ),
              ],
              const SizedBox(height: 20),
              const Text(
                'Ao tocar em Atualizar, o Android pode pedir para permitir a instalação de apps '
                'desta fonte: permita, confirme a instalação e abra o app de novo.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: AppColors.muted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
