import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/formatacao.dart';
import '../../core/models/notificacao.dart';
import '../../core/push/push_navigation.dart';
import '../../core/providers/notificacoes_provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/app_badge.dart';
import '../../widgets/listagem_feedback.dart';
import '../../widgets/pagination_bar.dart';

/// Histórico de notificações (equivalente à `frontend/src/app/
/// notificacoes/page.tsx`) - inbox pessoal, paginada, com filtro Todas/Não
/// lidas e "marcar como lida" (individual e em massa). Diferente da
/// `NotificacoesConfigScreen` (só configura push em primeiro plano, sem
/// histórico nenhum).
class NotificacoesScreen extends ConsumerStatefulWidget {
  const NotificacoesScreen({super.key});

  @override
  ConsumerState<NotificacoesScreen> createState() => _NotificacoesScreenState();
}

class _NotificacoesScreenState extends ConsumerState<NotificacoesScreen> {
  int _pagina = 1;
  bool _apenasNaoLidas = false;
  bool _marcandoTodas = false;

  void _invalidarTudo() {
    ref.invalidate(notificacoesProvider((pagina: _pagina, apenasNaoLidas: _apenasNaoLidas)));
    ref.invalidate(contagemNaoLidasProvider);
  }

  Future<void> _marcarTodasComoLidas() async {
    setState(() => _marcandoTodas = true);
    try {
      await ref.read(notificacoesServiceProvider).marcarTodasComoLidas();
      if (!mounted) return;
      _invalidarTudo();
    } catch (erro) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Falha ao marcar todas como lidas: $erro')));
    } finally {
      if (mounted) setState(() => _marcandoTodas = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final listaAsync = ref.watch(
      notificacoesProvider((pagina: _pagina, apenasNaoLidas: _apenasNaoLidas)),
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificações'),
        actions: [
          if (_marcandoTodas)
            const Padding(
              padding: EdgeInsets.all(16),
              child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.foreground),
              ),
            )
          else
            TextButton(onPressed: _marcarTodasComoLidas, child: const Text('Marcar todas')),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          Row(
            children: [
              ChoiceChip(
                label: const Text('Todas'),
                selected: !_apenasNaoLidas,
                onSelected: (_) => setState(() {
                  _apenasNaoLidas = false;
                  _pagina = 1;
                }),
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text('Não lidas'),
                selected: _apenasNaoLidas,
                onSelected: (_) => setState(() {
                  _apenasNaoLidas = true;
                  _pagina = 1;
                }),
              ),
            ],
          ),
          const SizedBox(height: 16),
          listaAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
            ),
            error: (erro, _) => ErroConexao(mensagem: '$erro', aoTentarNovamente: _invalidarTudo),
            data: (resultado) => resultado.data.isEmpty
                ? EstadoVazio(
                    mensagem: _apenasNaoLidas
                        ? 'Nenhuma notificação não lida.'
                        : 'Nenhuma notificação ainda.',
                  )
                : Column(
                    children: [
                      for (final notificacao in resultado.data) ...[
                        _LinhaNotificacao(
                          notificacao: notificacao,
                          aoMarcarComoLida: _invalidarTudo,
                        ),
                        const SizedBox(height: 8),
                      ],
                      const SizedBox(height: 8),
                      PaginationBar(
                        pagina: resultado.page,
                        totalPaginas: resultado.totalPages,
                        aoMudarPagina: (p) => setState(() => _pagina = p),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _LinhaNotificacao extends ConsumerStatefulWidget {
  const _LinhaNotificacao({required this.notificacao, required this.aoMarcarComoLida});

  final Notificacao notificacao;
  final VoidCallback aoMarcarComoLida;

  @override
  ConsumerState<_LinhaNotificacao> createState() => _LinhaNotificacaoState();
}

class _LinhaNotificacaoState extends ConsumerState<_LinhaNotificacao> {
  bool _marcando = false;

  Future<void> _marcarComoLida() async {
    setState(() => _marcando = true);
    try {
      await ref.read(notificacoesServiceProvider).marcarComoLida(widget.notificacao.id);
      if (!mounted) return;
      widget.aoMarcarComoLida();
    } catch (erro) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Falha ao marcar como lida: $erro')));
      setState(() => _marcando = false);
    }
  }

  // Notificação de pedido abre o pedido; a de solicitação de desconto (do
  // supervisor) abre as Aprovações - mesma regra do toque no push (ver
  // navegarParaNotificacao). Abrir já marca como lida.
  bool get _temDestino =>
      widget.notificacao.dados['pedidoId'] != null ||
      widget.notificacao.dados['produtoId'] != null ||
      widget.notificacao.dados['solicitacaoId'] != null;

  void _abrir() {
    if (!widget.notificacao.lida && !_marcando) {
      _marcarComoLida();
    }
    navegarParaNotificacao(widget.notificacao.dados);
  }

  @override
  Widget build(BuildContext context) {
    final notificacao = widget.notificacao;
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: _temDestino ? _abrir : null,
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.line),
            borderRadius: BorderRadius.circular(12),
          ),
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!notificacao.lida) ...[
                const Padding(
                  padding: EdgeInsets.only(top: 5),
                  child: CircleAvatar(radius: 4, backgroundColor: AppColors.primary),
                ),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notificacao.titulo,
                      style: TextStyle(
                        fontWeight: notificacao.lida ? FontWeight.w500 : FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      notificacao.corpo,
                      style: const TextStyle(fontSize: 12, color: AppColors.muted),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      formatarDataHora(notificacao.criadoEm),
                      style: const TextStyle(fontSize: 11, color: AppColors.muted),
                    ),
                    if (_temDestino)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          notificacao.dados['pedidoId'] != null
                              ? 'Ver pedido'
                              : (notificacao.dados['produtoId'] != null
                                    ? 'Ver produto'
                                    : 'Ver aprovações'),
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (notificacao.lida)
                const AppBadge(texto: 'Lida')
              else if (_marcando)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                )
              else
                TextButton(onPressed: _marcarComoLida, child: const Text('Marcar como lida')),
            ],
          ),
        ),
      ),
    );
  }
}
