import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/auth/auth_notifier.dart';
import '../core/health_provider.dart';
import '../core/models/dashboard.dart';
import '../core/models/pedido.dart';
import '../core/providers/dashboard_provider.dart';
import '../core/providers/offline_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/app_badge.dart';
import '../widgets/app_card.dart';
import '../widgets/list_item_tile.dart';
import '../widgets/listagem_feedback.dart';
import '../widgets/stat_card.dart';
import '../core/formatacao.dart';
import 'busca_screen.dart';
import 'clientes_screen.dart';
import 'estoque_screen.dart';
import 'notificacoes_config_screen.dart';
import 'pedidos_screen.dart';
import 'pedido_detalhe_screen.dart';
import 'produtos_screen.dart';
import 'rastreio_config_screen.dart';
import 'roteiro_screen.dart';

/// Tela inicial (OS-MOBILE-11) - reformulada na OS-MOBILE-14: antes era só
/// um menu de atalhos (ver histórico do arquivo), agora mostra resumo do
/// dia (pedidos recentes + alertas de estoque crítico, GET /dashboard/*,
/// OS-BACKEND-17 - mesmos endpoints do painel web, OS-WEB-19) como
/// conteúdo PRINCIPAL, com os atalhos de navegação reduzidos a uma faixa
/// compacta secundária (ver skill design-system, "Exemplo aplicado":
/// "resumo do dia... com ações rápidas").
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usuario = ref.watch(authProvider).value?.usuario;
    final saude = ref.watch(healthProvider);
    final resumo = ref.watch(resumoDashboardProvider);
    final estoqueCritico = ref.watch(estoqueCriticoDashboardProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Copperline'),
        actions: [
          IconButton(
            tooltip: 'Rastreio',
            icon: const Icon(Icons.my_location_outlined),
            onPressed: () => Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => const RastreioConfigScreen())),
          ),
          IconButton(
            tooltip: 'Notificações',
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => const NotificacoesConfigScreen())),
          ),
          IconButton(
            tooltip: 'Sair',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authProvider.notifier).logout(),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(resumoDashboardProvider);
            ref.invalidate(estoqueCriticoDashboardProvider);
            await Future.wait([
              ref.read(resumoDashboardProvider.future),
              ref.read(estoqueCriticoDashboardProvider.future),
            ]);
          },
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              if (usuario != null) ...[
                Text('Olá, ${usuario.name}', style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 16),
              ],

              // Campo de busca sempre visível na navegação principal
              // (OS-MOBILE-15, critério de aceite explícito) - "botão que
              // parece campo de busca" (mesmo padrão de apps como
              // Google/Spotify): não abre teclado aqui, só navega pra
              // BuscaScreen, que aí sim tem o TextField de verdade.
              _CampoBuscaAtalho(
                onTap: () => Navigator.of(
                  context,
                ).push(MaterialPageRoute(builder: (_) => const BuscaScreen())),
              ),
              const SizedBox(height: 20),

              _IndicadorAcoesPendentes(),
              const SizedBox(height: 16),

              saude.when(
                data: (status) => _StatusApi(status: status),
                loading: () => const SizedBox.shrink(),
                error: (erro, _) => ErroConexao(
                  mensagem: erro.toString(),
                  aoTentarNovamente: () => ref.read(healthProvider.notifier).recarregar(),
                ),
              ),
              const SizedBox(height: 16),

              _FaixaAcoesRapidas(),
              const SizedBox(height: 24),

              resumo.when(
                data: (dados) => _StatsResumo(resumo: dados),
                loading: () => const _CarregandoInline(),
                error: (erro, _) => ErroConexao(
                  mensagem: erro.toString(),
                  aoTentarNovamente: () => ref.invalidate(resumoDashboardProvider),
                ),
              ),
              const SizedBox(height: 24),

              Text('Estoque crítico', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              estoqueCritico.when(
                data: (dados) => dados.produtos.isEmpty
                    ? const EstadoVazio(
                        mensagem: 'Nenhum produto com estoque crítico e pedido pendente no momento.',
                      )
                    : Column(
                        children: [
                          for (final produto in dados.produtos) ...[
                            ListItemTile(
                              titulo: produto.titulo,
                              subtitulo:
                                  'Código ${produto.codigo} · ${produto.quantidadePedidosPendentes} pedido(s) pendente(s)',
                              valor: '${produto.quantidadeDisponivel} disponível',
                              tag: const AppBadge(texto: 'Crítico', enfase: true),
                            ),
                            const SizedBox(height: 8),
                          ],
                        ],
                      ),
                loading: () => const _CarregandoInline(),
                error: (erro, _) => ErroConexao(
                  mensagem: erro.toString(),
                  aoTentarNovamente: () => ref.invalidate(estoqueCriticoDashboardProvider),
                ),
              ),
              const SizedBox(height: 24),

              Text('Pedidos recentes', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              resumo.when(
                data: (dados) => dados.pedidosRecentes.isEmpty
                    ? const EstadoVazio(mensagem: 'Nenhum pedido sincronizado ainda.')
                    : Column(
                        children: [
                          for (final pedido in dados.pedidosRecentes) ...[
                            _ItemPedidoRecente(pedido: pedido),
                            const SizedBox(height: 8),
                          ],
                        ],
                      ),
                loading: () => const SizedBox.shrink(),
                error: (_, _) => const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatsResumo extends StatelessWidget {
  const _StatsResumo({required this.resumo});

  final ResumoDashboard resumo;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.6,
      children: [
        StatCard(
          icone: Icons.people_outline,
          label: 'Clientes ativos',
          valor: '${resumo.clientesAtivos}',
        ),
        StatCard(
          icone: Icons.category_outlined,
          label: 'Produtos ativos',
          valor: '${resumo.produtosAtivos}',
        ),
        StatCard(
          icone: Icons.pending_actions_outlined,
          label: 'Pedidos em aberto',
          valor: '${resumo.pedidosEmAberto}',
        ),
        StatCard(
          icone: Icons.payments_outlined,
          label: 'Faturado (${resumo.periodoValorFaturadoDias}d)',
          valor: formatarMoeda(resumo.valorFaturadoRecente),
        ),
      ],
    );
  }
}

class _ItemPedidoRecente extends StatelessWidget {
  const _ItemPedidoRecente({required this.pedido});

  final PedidoResumo pedido;

  @override
  Widget build(BuildContext context) {
    final situacaoConfig = configSituacaoPedido(pedido.situacao);
    return ListItemTile(
      titulo: pedido.tituloCliente,
      subtitulo: 'Pedido ${pedido.numero ?? "—"} · ${formatarData(pedido.dataHoraUltimaAlteracao)}',
      valor: formatarMoeda(pedido.valorTotal),
      tag: AppBadge(texto: situacaoConfig.rotulo, enfase: situacaoConfig.enfase),
      onTap: () => Navigator.of(
        context,
      ).push(MaterialPageRoute(builder: (_) => PedidoDetalheScreen(id: pedido.id))),
    );
  }
}

class _CarregandoInline extends StatelessWidget {
  const _CarregandoInline();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 16),
      child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
    );
  }
}

class _FaixaAcoesRapidas extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 84,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _AcaoRapida(
            icone: Icons.inventory_2_outlined,
            titulo: 'Estoque',
            onTap: () => Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => const EstoqueScreen())),
          ),
          _AcaoRapida(
            icone: Icons.people_outline,
            titulo: 'Clientes',
            onTap: () => Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => const ClientesScreen())),
          ),
          _AcaoRapida(
            icone: Icons.category_outlined,
            titulo: 'Produtos',
            onTap: () => Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => const ProdutosScreen())),
          ),
          _AcaoRapida(
            icone: Icons.receipt_long_outlined,
            titulo: 'Pedidos',
            onTap: () => Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => const PedidosScreen())),
          ),
          _AcaoRapida(
            icone: Icons.map_outlined,
            titulo: 'Roteiro',
            onTap: () => Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => const RoteiroScreen())),
          ),
        ],
      ),
    );
  }
}

class _AcaoRapida extends StatelessWidget {
  const _AcaoRapida({required this.icone, required this.titulo, required this.onTap});

  final IconData icone;
  final String titulo;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          width: 76,
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(20),
            boxShadow: const [
              BoxShadow(color: Color(0x14000000), blurRadius: 8, offset: Offset(0, 2)),
            ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: AppColors.primaryLight,
                child: Icon(icone, size: 18, color: AppColors.primary),
              ),
              const SizedBox(height: 6),
              Text(
                titulo,
                style: const TextStyle(fontSize: 11, color: AppColors.ink),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Indicador de "pendente de envio" (OS-MOBILE-22, critério de aceite
/// explícito) - só aparece quando há ação offline aguardando sincronizar
/// (ver contagemPendentesProvider). Ainda sem nenhuma tela criando ações
/// offline (OS-MOBILE-20/21/23) - fica pronto e invisível até a primeira
/// dessas telas chamar FilaPendenteService.enfileirar.
class _IndicadorAcoesPendentes extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contagem = ref.watch(contagemPendentesProvider);

    return contagem.when(
      data: (total) {
        if (total == 0) return const SizedBox.shrink();
        return InkWell(
          onTap: () async {
            await ref.read(offlineSyncNotifierProvider).sincronizarAgora();
          },
          borderRadius: BorderRadius.circular(999),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              children: [
                const Icon(Icons.cloud_upload_outlined, size: 16, color: AppColors.muted),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    total == 1
                        ? '1 ação aguardando envio - toque para tentar agora'
                        : '$total ações aguardando envio - toque para tentar agora',
                    style: const TextStyle(fontSize: 12, color: AppColors.muted),
                  ),
                ),
              ],
            ),
          ),
        );
      },
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
    );
  }
}

class _StatusApi extends StatelessWidget {
  const _StatusApi({required this.status});

  final HealthStatus status;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          Icon(
            status.ok ? Icons.check_circle_outline : Icons.error_outline,
            color: status.ok ? AppColors.primary : AppColors.muted,
            size: 18,
          ),
          const SizedBox(width: 8),
          Text('API: ${status.status}', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
        ],
      ),
    );
  }
}

class _CampoBuscaAtalho extends StatelessWidget {
  const _CampoBuscaAtalho({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(999),
          boxShadow: const [
            BoxShadow(color: Color(0x14000000), blurRadius: 8, offset: Offset(0, 2)),
          ],
        ),
        child: const Row(
          children: [
            Icon(Icons.search, size: 20, color: AppColors.muted),
            SizedBox(width: 10),
            Text(
              'Buscar cliente, produto ou pedido...',
              style: TextStyle(color: AppColors.muted, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }
}
