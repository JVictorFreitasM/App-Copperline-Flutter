import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../core/formatacao.dart';
import '../theme/app_colors.dart';

/// Medidor circular de progresso da meta do mes (OS-MOBILE-41), pro card
/// "so numero" da home virar algo visual. Sem meta configurada
/// (`percentual == null`) mostra so o valor vendido, sem fingir um
/// percentual contra uma meta que nao existe.
class MetaGauge extends StatelessWidget {
  const MetaGauge({
    super.key,
    required this.valorVendido,
    required this.valorMeta,
    required this.percentualAtingido,
  });

  final double valorVendido;
  final double? valorMeta;
  final double? percentualAtingido;

  @override
  Widget build(BuildContext context) {
    final fracao = percentualAtingido == null
        ? null
        : math.min(percentualAtingido! / 100, 1.0);

    return Row(
      children: [
        SizedBox(
          width: 56,
          height: 56,
          child: Stack(
            alignment: Alignment.center,
            children: [
              CircularProgressIndicator(
                value: fracao ?? 0,
                strokeWidth: 6,
                backgroundColor: AppColors.line,
                valueColor: const AlwaysStoppedAnimation(AppColors.primary),
              ),
              Text(
                fracao == null ? '—' : '${(fracao * 100).round()}%',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
              ),
            ],
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Meta do mês', style: TextStyle(color: AppColors.muted, fontSize: 11)),
              const SizedBox(height: 2),
              Text(
                formatarMoeda('$valorVendido'),
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
              ),
              if (valorMeta != null)
                Text(
                  'de ${formatarMoeda('$valorMeta')}',
                  style: const TextStyle(fontSize: 11, color: AppColors.muted),
                )
              else
                const Text(
                  'Sem meta definida pra este mês',
                  style: TextStyle(fontSize: 11, color: AppColors.muted),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
