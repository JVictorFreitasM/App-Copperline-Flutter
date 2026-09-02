import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'app_card.dart';

/// Mesmo par de estados do web
/// (`frontend/src/components/listagem-feedback.tsx`) - toda listagem usa
/// esses dois widgets em vez de texto solto improvisado por tela.
class EstadoVazio extends StatelessWidget {
  const EstadoVazio({super.key, required this.mensagem});

  final String mensagem;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Text(mensagem, style: const TextStyle(color: AppColors.muted)),
    );
  }
}

class ErroConexao extends StatelessWidget {
  const ErroConexao({
    super.key,
    required this.mensagem,
    this.aoTentarNovamente,
    this.titulo = 'Falha ao conectar com a API',
  });

  final String mensagem;
  final VoidCallback? aoTentarNovamente;
  final String titulo;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            titulo,
            style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink),
          ),
          const SizedBox(height: 4),
          Text(mensagem, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          if (aoTentarNovamente != null) ...[
            const SizedBox(height: 12),
            ElevatedButton(onPressed: aoTentarNovamente, child: const Text('Tentar novamente')),
          ],
        ],
      ),
    );
  }
}
