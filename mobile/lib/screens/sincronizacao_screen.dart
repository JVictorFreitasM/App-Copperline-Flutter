import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/formatacao.dart';
import '../core/local_db/acao_pendente.dart';
import '../core/providers/offline_provider.dart';
import '../core/providers/sincronizacao_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/app_card.dart';

String _rotuloTipo(TipoAcaoFila tipo) => switch (tipo) {
  TipoAcaoFila.criarPedido => 'Pedido',
  TipoAcaoFila.checkinVisita => 'Check-in',
  TipoAcaoFila.checkoutVisita => 'Checkout',
  TipoAcaoFila.cancelarVisita => 'Cancelamento de visita',
  TipoAcaoFila.rastreioLote => 'Rastreio',
};

/// Referência do que está salvo no aparelho e do estado da sincronização:
/// quando foi a última, quanto de cada dado já está disponível offline e o que
/// ainda aguarda envio. "Sincronizar agora" (ou puxar a tela) refaz tudo.
class SincronizacaoScreen extends ConsumerWidget {
  const SincronizacaoScreen({super.key});

  Future<void> _sincronizar(WidgetRef ref) =>
      ref.read(sincronizacaoProvider.notifier).sincronizar();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final estado = ref.watch(sincronizacaoProvider);
    final pendentes = ref.watch(listaAcoesPendentesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Sincronização')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _sincronizar(ref),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          estado.sincronizando
                              ? Icons.sync
                              : (estado.erro != null
                                    ? Icons.cloud_off_outlined
                                    : Icons.cloud_done_outlined),
                          color: estado.erro != null && !estado.sincronizando
                              ? AppColors.amber
                              : AppColors.primary,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            estado.sincronizando
                                ? 'Sincronizando...'
                                : (estado.erro != null ? 'Não sincronizou agora' : 'Sincronizado'),
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AppColors.ink,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      estado.ultimaSincronizacao == null
                          ? 'Última sincronização: ainda não houve neste aparelho.'
                          : 'Última sincronização: ${formatarDataHora(estado.ultimaSincronizacao!.toIso8601String())}',
                      style: const TextStyle(fontSize: 12, color: AppColors.muted),
                    ),
                    if (estado.erro != null && !estado.sincronizando) ...[
                      const SizedBox(height: 6),
                      Text(
                        estado.erro!,
                        style: const TextStyle(fontSize: 12, color: AppColors.amber),
                      ),
                    ],
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: estado.sincronizando ? null : () => _sincronizar(ref),
                        icon: const Icon(Icons.sync, size: 18),
                        label: Text(
                          estado.sincronizando ? 'Sincronizando...' : 'Sincronizar agora',
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text('Disponível sem internet', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              AppCard(
                child: Column(
                  children: [
                    _LinhaDado('Clientes da carteira (com detalhes)', estado.dados.clientes),
                    _LinhaDado('Produtos', estado.dados.produtos),
                    _LinhaDado('Tabelas de preço', estado.dados.tabelas),
                    _LinhaDado('Preços de produto por tabela', estado.dados.precos),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Text('Aguardando envio', style: Theme.of(context).textTheme.titleMedium),
                  ),
                  AppBadge(texto: '${estado.pendentes}', enfase: estado.pendentes > 0),
                ],
              ),
              const SizedBox(height: 8),
              pendentes.when(
                loading: () => const SizedBox.shrink(),
                error: (_, _) => const SizedBox.shrink(),
                data: (lista) => lista.isEmpty
                    ? const AppCard(
                        child: Text(
                          'Nada pendente - tudo que foi feito neste aparelho já foi enviado.',
                          style: TextStyle(fontSize: 12, color: AppColors.muted),
                        ),
                      )
                    : Column(
                        children: [
                          for (final acao in lista) ...[
                            AppCard(
                              padding: const EdgeInsets.all(12),
                              child: Row(
                                children: [
                                  Icon(
                                    acao.status == StatusAcaoPendente.erro
                                        ? Icons.error_outline
                                        : Icons.schedule,
                                    size: 18,
                                    color: acao.status == StatusAcaoPendente.erro
                                        ? AppColors.red
                                        : AppColors.muted,
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          _rotuloTipo(acao.tipo),
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.ink,
                                          ),
                                        ),
                                        Text(
                                          formatarDataHora(acao.timestamp),
                                          style: const TextStyle(
                                            fontSize: 11,
                                            color: AppColors.muted,
                                          ),
                                        ),
                                        if (acao.erro != null)
                                          Text(
                                            acao.erro!,
                                            style: const TextStyle(
                                              fontSize: 11,
                                              color: AppColors.red,
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 8),
                          ],
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LinhaDado extends StatelessWidget {
  const _LinhaDado(this.rotulo, this.valor);

  final String rotulo;
  final int valor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Expanded(
            child: Text(rotulo, style: const TextStyle(fontSize: 13, color: AppColors.ink)),
          ),
          Text(
            '$valor',
            style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
          ),
        ],
      ),
    );
  }
}
