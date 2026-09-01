import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

/// Placeholder honesto (replica o padrão "empty state" da referência,
/// Downloads/aplicativo-comercial-interno) - não existe tela de notas
/// fiscais/documentos no mobile ainda (só no web, ver
/// frontend/src/app/notas-fiscais). Melhor mostrar isso claramente do que
/// fingir uma funcionalidade que não existe.
class DocumentosScreen extends StatelessWidget {
  const DocumentosScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Documentos')),
      body: const SafeArea(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _IconeVazio(),
                SizedBox(height: 18),
                Text(
                  'Seus documentos',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                SizedBox(height: 8),
                Text(
                  'Notas fiscais e comprovantes ainda não estão disponíveis '
                  'no app - consulte pelo sistema web.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.muted, fontSize: 12, height: 1.5),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _IconeVazio extends StatelessWidget {
  const _IconeVazio();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 64,
      height: 64,
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(18),
      ),
      alignment: Alignment.center,
      child: const Icon(Icons.description_outlined, size: 30, color: AppColors.primary),
    );
  }
}
