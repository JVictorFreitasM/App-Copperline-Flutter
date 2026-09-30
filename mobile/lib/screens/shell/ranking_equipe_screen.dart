import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/formatacao.dart';
import '../../core/models/ranking_equipe.dart';
import '../../core/providers/aprovacoes_provider.dart';
import '../../core/providers/ranking_equipe_provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/app_card.dart';
import '../../widgets/listagem_feedback.dart';

/// Tela "Ranking de equipe" (equivalente à seção de ranking em
/// `frontend/src/app/metas/page.tsx`) - mensal apenas (sem seletor de
/// periodicidade, diferente da meta pessoal). 403 (perfil sem acesso) vira
/// estado "não disponível", não erro de conexão (ver
/// ranking_equipe_provider.dart).
class RankingEquipeScreen extends ConsumerWidget {
  const RankingEquipeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rankingAsync = ref.watch(rankingEquipeProvider);
    final meuVendedorAsync = ref.watch(meuVendedorProvider);
    final meuVendedorId = meuVendedorAsync.asData?.value.vendedorId;

    return Scaffold(
      appBar: AppBar(title: const Text('Ranking de equipe')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            Text(
              'Vendas do mês (${mesAnoExibicao()})',
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
            const SizedBox(height: 16),
            rankingAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
              ),
              error: (erro, _) => ErroConexao(
                mensagem: '$erro',
                aoTentarNovamente: () => ref.invalidate(rankingEquipeProvider),
              ),
              data: (ranking) {
                if (ranking == null) {
                  return const EstadoVazio(mensagem: 'Ranking não disponível pro seu perfil.');
                }
                if (ranking.isEmpty) {
                  return const EstadoVazio(mensagem: 'Nenhum dado de vendas neste mês ainda.');
                }
                return AppCard(
                  child: Column(
                    children: [
                      for (var i = 0; i < ranking.length; i++) ...[
                        if (i > 0) const Divider(height: 20),
                        _LinhaRanking(
                          posicao: i + 1,
                          item: ranking[i],
                          souEu: ranking[i].vendedorId == meuVendedorId,
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

// "setembro/2026" a partir de "2026-09" - só exibição, não usado na query.
String mesAnoExibicao() {
  final agora = DateTime.now();
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  return '${meses[agora.month - 1]}/${agora.year}';
}

class _LinhaRanking extends StatelessWidget {
  const _LinhaRanking({required this.posicao, required this.item, required this.souEu});

  final int posicao;
  final RankingEquipeItem item;
  final bool souEu;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 28,
          height: 28,
          alignment: Alignment.center,
          decoration: const BoxDecoration(color: AppColors.background, shape: BoxShape.circle),
          child: Text('$posicao', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            souEu ? '${item.nome ?? "—"} (você)' : (item.nome ?? '—'),
            style: TextStyle(fontWeight: souEu ? FontWeight.w800 : FontWeight.w500),
          ),
        ),
        Text(
          formatarMoeda('${item.valorVendido}'),
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ],
    );
  }
}
