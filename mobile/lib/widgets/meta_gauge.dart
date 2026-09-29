import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../core/formatacao.dart';
import '../theme/app_colors.dart';

/// Medidor circular de progresso da meta (OS-MOBILE-41), pro card "so
/// numero" da home virar algo visual. Sem meta configurada
/// (`percentualAtingido == null` E `tipoMeta == null`) mostra so o valor
/// vendido, sem fingir um percentual contra uma meta que nao existe.
///
/// Pedido do usuário (2026-09-29): tipoMeta decide a UNIDADE mostrada
/// (Dinheiro -> R$, Peso -> Kg) e periodicidade decide o titulo (mensal/
/// semanal - o widget agora e' usado duas vezes na home, um pra cada).
/// Margem ainda nao tem calculo de progresso (mesmo criterio do backend,
/// ver MetaVendedorService) - mostra so a meta configurada, sem gauge
/// nem "valor vendido" inventado.
class MetaGauge extends StatelessWidget {
  const MetaGauge({
    super.key,
    required this.periodicidade,
    required this.tipoMeta,
    required this.valorVendido,
    required this.valorMeta,
    required this.percentualAtingido,
  });

  final String periodicidade; // "MENSAL" | "SEMANAL"
  final String? tipoMeta; // "DINHEIRO" | "PESO" | "MARGEM" | null
  final double valorVendido;
  final double? valorMeta;
  final double? percentualAtingido;

  String get _titulo => periodicidade == 'SEMANAL' ? 'Meta da semana' : 'Meta do mês';

  String _formatarValor(double valor) {
    return tipoMeta == 'PESO' ? formatarPeso('$valor') : formatarMoeda('$valor');
  }

  @override
  Widget build(BuildContext context) {
    final margemSemCalculo = tipoMeta == 'MARGEM';
    final fracao = percentualAtingido == null
        ? null
        : math.min(percentualAtingido! / 100, 1.0);

    if (margemSemCalculo) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.percent, color: AppColors.muted, size: 32),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_titulo, style: const TextStyle(color: AppColors.muted, fontSize: 11)),
                const SizedBox(height: 2),
                Text(
                  'Margem de lucro: ${valorMeta?.toStringAsFixed(0) ?? "—"}%',
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                ),
                const Text(
                  'Cálculo de progresso ainda não disponível pra este tipo.',
                  style: TextStyle(fontSize: 11, color: AppColors.muted),
                ),
              ],
            ),
          ),
        ],
      );
    }

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
              Text(_titulo, style: const TextStyle(color: AppColors.muted, fontSize: 11)),
              const SizedBox(height: 2),
              Text(
                _formatarValor(valorVendido),
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
              ),
              if (valorMeta != null)
                Text(
                  'de ${_formatarValor(valorMeta!)}',
                  style: const TextStyle(fontSize: 11, color: AppColors.muted),
                )
              else
                Text(
                  periodicidade == 'SEMANAL'
                      ? 'Sem meta definida pra esta semana'
                      : 'Sem meta definida pra este mês',
                  style: const TextStyle(fontSize: 11, color: AppColors.muted),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
