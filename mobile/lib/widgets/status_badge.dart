import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

enum Tom { ok, atencao, critico, pendente }

/// Pill de status colorido (bolinha + texto) - replica `.status` da
/// referência (Downloads/aplicativo-comercial-interno): verde pra "Ativo"/
/// "Enviado"/"aprovado", vermelho pra "Atenção"/crítico, âmbar pra
/// "Pendente"/"em andamento". Diferente do [AppBadge] antigo (só
/// preto/cinza) - a referência usa cor de status de verdade, então esse é
/// o widget certo pra telas que seguem essa referência.
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.texto, this.tom = Tom.ok});

  final String texto;
  final Tom tom;

  @override
  Widget build(BuildContext context) {
    final (cor, fundo) = switch (tom) {
      Tom.ok => (AppColors.green, AppColors.greenLight),
      Tom.atencao => (AppColors.red, AppColors.redLight),
      Tom.critico => (AppColors.red, AppColors.redLight),
      Tom.pendente => (AppColors.amber, AppColors.amberLight),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: fundo, borderRadius: BorderRadius.circular(20)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(color: cor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            texto,
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: cor),
          ),
        ],
      ),
    );
  }
}
