import 'package:flutter/material.dart';
import '../core/formatacao.dart';
import '../core/models/indicadores_home.dart';
import '../theme/app_colors.dart';

/// Mini gráfico de evolução semanal de vendas (OS-MOBILE-41) - sem
/// dependência de biblioteca de gráfico nova (mobile não tem nenhuma
/// ainda, ver pubspec.yaml), so' um CustomPainter simples pra uma
/// polyline, suficiente pro escopo de "sparkline".
class SparklineVendas extends StatelessWidget {
  const SparklineVendas({super.key, required this.semanas});

  final List<SemanaVenda> semanas;

  @override
  Widget build(BuildContext context) {
    if (semanas.every((s) => s.valorVendido == 0)) {
      return const Text(
        'Sem vendas nas últimas semanas.',
        style: TextStyle(fontSize: 11, color: AppColors.muted),
      );
    }

    final ultima = semanas.last;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Vendas por semana', style: TextStyle(color: AppColors.muted, fontSize: 11)),
        const SizedBox(height: 6),
        SizedBox(
          height: 36,
          width: double.infinity,
          child: CustomPaint(painter: _SparklinePainter(semanas)),
        ),
        const SizedBox(height: 6),
        Text(
          'Última semana: ${formatarMoeda('${ultima.valorVendido}')}',
          style: const TextStyle(fontSize: 11, color: AppColors.muted),
        ),
      ],
    );
  }
}

class _SparklinePainter extends CustomPainter {
  _SparklinePainter(this.semanas);

  final List<SemanaVenda> semanas;

  @override
  void paint(Canvas canvas, Size size) {
    if (semanas.length < 2) return;

    final valores = semanas.map((s) => s.valorVendido).toList();
    final maximo = valores.reduce((a, b) => a > b ? a : b);
    final minimo = valores.reduce((a, b) => a < b ? a : b);
    final amplitude = (maximo - minimo) == 0 ? 1 : (maximo - minimo);

    final passoX = size.width / (semanas.length - 1);
    final pontos = <Offset>[
      for (var i = 0; i < semanas.length; i++)
        Offset(
          i * passoX,
          size.height - ((valores[i] - minimo) / amplitude) * size.height,
        ),
    ];

    final linha = Paint()
      ..color = AppColors.primary
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    final caminho = Path()..moveTo(pontos.first.dx, pontos.first.dy);
    for (final ponto in pontos.skip(1)) {
      caminho.lineTo(ponto.dx, ponto.dy);
    }
    canvas.drawPath(caminho, linha);

    canvas.drawCircle(pontos.last, 3, Paint()..color = AppColors.primary);
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter oldDelegate) {
    return oldDelegate.semanas != semanas;
  }
}
