import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Chip neutro (preto/cinza) - mesmo vocabulário do web
/// (`frontend/src/components/badge.tsx`, ver skill `design-system`: não
/// introduzir verde/vermelho sem necessidade real). `enfase` só destaca o
/// que já concluiu (ex: pedido faturado).
class AppBadge extends StatelessWidget {
  const AppBadge({super.key, required this.texto, this.enfase = false});

  final String texto;
  final bool enfase;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: enfase ? AppColors.ink : AppColors.background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        texto,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: enfase ? AppColors.surface : AppColors.muted,
        ),
      ),
    );
  }
}

class BadgeAtivoInativo extends StatelessWidget {
  const BadgeAtivoInativo({super.key, required this.inativo});

  final bool inativo;

  @override
  Widget build(BuildContext context) {
    return AppBadge(texto: inativo ? 'Inativo' : 'Ativo', enfase: !inativo);
  }
}
