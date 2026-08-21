import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Mesmo papel do `Paginacao` web (`frontend/src/components/paginacao.tsx`)
/// - anterior/próxima + "Página X de Y", sem input de página livre (mesma
/// decisão do web, simplicidade sobre flexibilidade que ninguém pediu).
class PaginationBar extends StatelessWidget {
  const PaginationBar({
    super.key,
    required this.pagina,
    required this.totalPaginas,
    required this.aoMudarPagina,
  });

  final int pagina;
  final int totalPaginas;
  final ValueChanged<int> aoMudarPagina;

  @override
  Widget build(BuildContext context) {
    if (totalPaginas <= 1) return const SizedBox.shrink();

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        TextButton(
          onPressed: pagina > 1 ? () => aoMudarPagina(pagina - 1) : null,
          child: const Text('Anterior'),
        ),
        Text('Página $pagina de $totalPaginas', style: const TextStyle(color: AppColors.muted)),
        TextButton(
          onPressed: pagina < totalPaginas ? () => aoMudarPagina(pagina + 1) : null,
          child: const Text('Próxima'),
        ),
      ],
    );
  }
}
