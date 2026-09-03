import 'package:flutter/material.dart';
import '../core/models/estoque.dart';
import '../theme/app_colors.dart';

// Mesmo limiar de "estoque crítico" já usado no dashboard
// (LIMIAR_ESTOQUE_CRITICO_PADRAO, backend/src/dashboard/dto/
// estoque-critico-dashboard.dto.ts) - constante de exibição, não dado de
// negócio persistido (SaldoEstoque não tem "estoque mínimo" vindo do ERP).
// Reaproveitada aqui só pra colorir a barra, não pra fingir um percentual
// de capacidade que não existe.
const _limiarCritico = 10;
const _limiarAtencao = 30;
// Teto puramente visual pra escalar o preenchimento da barra - não é uma
// capacidade real do produto, só evita que um saldo de 500 estoure o
// widget e que um saldo de 5 fique visualmente idêntico a zero.
const _tetoVisual = 60;

/// Saldo de estoque do produto favoritado do vendedor, como barra de
/// progresso colorida (OS-MOBILE-41). Sem conceito de "favorito mais
/// acessado" no backend (nunca existiu rastreio de acesso) - usa o
/// favorito local do vendedor (FavoritosNotifier, já existente desde a
/// OS-MOBILE-15) como o melhor sinal real disponível de "produto que o
/// vendedor acompanha", em vez de inventar uma métrica de acesso.
class EstoqueFavoritoBarra extends StatelessWidget {
  const EstoqueFavoritoBarra({super.key, required this.nomeProduto, required this.resultado});

  final String nomeProduto;
  final ResultadoEstoque resultado;

  @override
  Widget build(BuildContext context) {
    final saldoTotal = resultado.itens.fold<double>(
      0,
      (soma, item) => soma + (double.tryParse(item.quantidade) ?? 0),
    );
    final cor = saldoTotal <= _limiarCritico
        ? AppColors.red
        : (saldoTotal <= _limiarAtencao ? AppColors.amber : AppColors.green);
    final fracao = (saldoTotal / _tetoVisual).clamp(0.0, 1.0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                'Estoque · $nomeProduto',
                style: const TextStyle(color: AppColors.muted, fontSize: 11),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Text(
              saldoTotal.toStringAsFixed(0),
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: cor),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: fracao,
            minHeight: 8,
            backgroundColor: AppColors.line,
            valueColor: AlwaysStoppedAnimation(cor),
          ),
        ),
      ],
    );
  }
}
