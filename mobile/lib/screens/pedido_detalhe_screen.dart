import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_exception.dart';
import '../core/formatacao.dart';
import '../core/models/pedido.dart';
import '../core/providers/pedidos_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/app_card.dart';
import '../widgets/listagem_feedback.dart';
import '../widgets/pedido_stepper.dart';

/// Detalhe do pedido (mobile, equivalente à OS-WEB-15) - mostra o que a
/// listagem não mostra: os itens do pedido.
class PedidoDetalheScreen extends ConsumerWidget {
  const PedidoDetalheScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pedidoAsync = ref.watch(pedidoDetalheProvider(id));

    return Scaffold(
      appBar: AppBar(title: const Text('Pedido')),
      body: SafeArea(
        child: pedidoAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (erro, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: erro is ApiException && erro.statusCode == 404
                ? EstadoVazio(mensagem: "Pedido '$id' não encontrado.")
                : ErroConexao(mensagem: '$erro'),
          ),
          data: (pedido) {
            final situacaoConfig = configSituacaoPedido(pedido.situacao);
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        pedido.tituloCliente,
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                    ),
                    AppBadge(texto: situacaoConfig.rotulo, enfase: situacaoConfig.enfase),
                  ],
                ),
                Text(
                  'Pedido ${pedido.numero ?? "—"} · '
                  '${formatarData(pedido.dataHoraUltimaAlteracao)}',
                  style: const TextStyle(color: AppColors.muted),
                ),
                const SizedBox(height: 16),
                AppCard(child: PedidoStepper(situacao: pedido.situacao)),
                const SizedBox(height: 16),
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Valor total', style: TextStyle(color: AppColors.muted)),
                      Text(
                        formatarMoeda(pedido.valorTotal),
                        style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                Text('Itens', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                if (pedido.itens.isEmpty)
                  const EstadoVazio(mensagem: 'Nenhum item neste pedido.')
                else
                  for (final PedidoItem item in pedido.itens) ...[
                    AppCard(
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.produto?.nome ?? item.produto?.codigo ?? '—',
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Qtde ${item.quantidadeVenda ?? "—"} × '
                                  '${formatarMoeda(item.valorUnitario)}',
                                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            formatarMoeda(item.valorTotal),
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
              ],
            );
          },
        ),
      ),
    );
  }
}
