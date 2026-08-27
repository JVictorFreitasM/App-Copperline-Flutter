import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Card de estatística (grid 2x2) - ver skill `design-system`: ícone
/// circular + label pequeno + valor bold. Métrica secundária de apoio
/// (nunca o número principal da tela) - equivalente ao `StatCard` web
/// (`frontend/src/components/design/stat-card.tsx`).
class StatCard extends StatelessWidget {
  const StatCard({super.key, required this.icone, required this.label, required this.valor});

  final IconData icone;
  final String label;
  final String valor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 8, offset: Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: AppColors.primaryLight,
            child: Icon(icone, size: 16, color: AppColors.primary),
          ),
          const SizedBox(height: 10),
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          const SizedBox(height: 2),
          Text(
            valor,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.ink),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
