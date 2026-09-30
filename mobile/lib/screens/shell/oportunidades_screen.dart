import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/formatacao.dart';
import '../../core/models/oportunidade.dart';
import '../../core/providers/aprovacoes_provider.dart';
import '../../core/providers/oportunidades_provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/app_badge.dart';
import '../../widgets/app_card.dart';
import '../../widgets/listagem_feedback.dart';

/// Tela "Oportunidades" (equivalente à `frontend/src/app/oportunidades/
/// page.tsx`) - clientes com sinal de atenção (sem pedido há X dias,
/// aniversário de relacionamento, recompra próxima) detectados por regra
/// determinística no backend; `contexto` é a única parte gerada por IA
/// (frase curta, pode faltar sem invalidar o motivo). Mobile v1 sempre
/// mostra a própria carteira, sem seletor de vendedor da equipe (ver
/// oportunidades_provider.dart).
class OportunidadesScreen extends ConsumerWidget {
  const OportunidadesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meuVendedorAsync = ref.watch(meuVendedorProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Oportunidades')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            const Text(
              'Clientes que merecem atenção: sem pedido recente, aniversário de '
              'relacionamento ou provável recompra.',
              style: TextStyle(color: AppColors.muted, fontSize: 12),
            ),
            const SizedBox(height: 16),
            meuVendedorAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
              ),
              error: (erro, _) => ErroConexao(mensagem: '$erro'),
              data: (meuVendedor) {
                final vendedorId = meuVendedor.vendedorId;
                if (vendedorId == null) {
                  return const EstadoVazio(
                    mensagem: 'Seu usuário não está vinculado a um vendedor.',
                  );
                }
                return Consumer(
                  builder: (context, ref, _) {
                    final oportunidadesAsync = ref.watch(oportunidadesProvider(vendedorId));
                    return oportunidadesAsync.when(
                      loading: () => const Padding(
                        padding: EdgeInsets.symmetric(vertical: 32),
                        child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
                      ),
                      error: (erro, _) => ErroConexao(
                        mensagem: '$erro',
                        aoTentarNovamente: () => ref.invalidate(oportunidadesProvider(vendedorId)),
                      ),
                      data: (oportunidades) => oportunidades.isEmpty
                          ? const EstadoVazio(mensagem: 'Nenhuma oportunidade no momento.')
                          : Column(
                              children: [
                                for (final oportunidade in oportunidades) ...[
                                  _CardOportunidade(oportunidade: oportunidade),
                                  const SizedBox(height: 8),
                                ],
                              ],
                            ),
                    );
                  },
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _CardOportunidade extends StatelessWidget {
  const _CardOportunidade({required this.oportunidade});

  final OportunidadeCliente oportunidade;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  oportunidade.clienteNome ?? '—',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              AppBadge(texto: oportunidade.motivo['tipo'] as String? ?? '—'),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            rotuloMotivoOportunidade(oportunidade.motivo),
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Text(
            'Último pedido em ${formatarData(oportunidade.ultimaInteracaoEm)}',
            style: const TextStyle(fontSize: 11, color: AppColors.muted),
          ),
          if (oportunidade.contexto != null) ...[
            const SizedBox(height: 8),
            Text(oportunidade.contexto!, style: const TextStyle(fontSize: 12, color: AppColors.ink)),
          ],
        ],
      ),
    );
  }
}
