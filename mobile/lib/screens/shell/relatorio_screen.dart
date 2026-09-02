import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/formatacao.dart';
import '../../core/providers/dashboard_provider.dart';
import '../../core/providers/visitas_provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/listagem_feedback.dart';
import '../../widgets/status_badge.dart';
import '../pedido_detalhe_screen.dart';

String _hojeIso() => DateTime.now().toIso8601String().substring(0, 10);

/// Aba "Relatório" (replica a referência "Nexo Comercial") - card escuro
/// de faturamento + 2 cards de métrica + lista de pedidos recentes, TODOS
/// com dado real já buscado no backend (GET /dashboard/resumo,
/// OS-BACKEND-17, e GET /visitas/minhas, OS-MOBILE-17). A referência
/// mostra "meta diária"/"% da meta" e "atividade da equipe" - omitidos de
/// propósito: não existe conceito de meta configurável no backend nem
/// endpoint de atividade agregada da equipe por vendedor comum, e o
/// projeto não inventa dado que não vem de algum lugar real.
class RelatorioScreen extends ConsumerWidget {
  const RelatorioScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resumo = ref.watch(resumoDashboardProvider);
    final visitasHoje = ref.watch(minhasVisitasProvider(_hojeIso()));

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(resumoDashboardProvider);
        ref.invalidate(minhasVisitasProvider(_hojeIso()));
        await ref.read(resumoDashboardProvider.future);
      },
      child: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          resumo.when(
            loading: () => const _CardFaturamento(valor: null, dias: null),
            error: (erro, _) => ErroConexao(
              mensagem: '$erro',
              aoTentarNovamente: () => ref.invalidate(resumoDashboardProvider),
            ),
            data: (dados) => _CardFaturamento(
              valor: dados.valorFaturadoRecente,
              dias: dados.periodoValorFaturadoDias,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _CardMetrica(
                  rotulo: 'Visitas hoje',
                  valor: visitasHoje.maybeWhen(
                    data: (dados) => '${dados.length}',
                    orElse: () => '—',
                  ),
                  tom: Tom.pendente,
                  status: 'Hoje',
                ),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: resumo.maybeWhen(
                  data: (dados) => _CardMetrica(
                    rotulo: 'Pedidos em aberto',
                    valor: '${dados.pedidosEmAberto}',
                    tom: Tom.ok,
                    status: 'Carteira',
                  ),
                  orElse: () => const _CardMetrica(
                    rotulo: 'Pedidos em aberto',
                    valor: '—',
                    tom: Tom.ok,
                    status: 'Carteira',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text('Pedidos recentes', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          resumo.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
            ),
            error: (erro, _) => ErroConexao(mensagem: '$erro'),
            data: (dados) => dados.pedidosRecentes.isEmpty
                ? const EstadoVazio(mensagem: 'Nenhum pedido recente.')
                : Column(
                    children: [
                      for (final pedido in dados.pedidosRecentes) ...[
                        _ItemPedido(pedido: pedido),
                        const SizedBox(height: 8),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _CardFaturamento extends StatelessWidget {
  const _CardFaturamento({required this.valor, required this.dias});

  final String? valor;
  final int? dias;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.navy,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            dias != null ? 'Faturado nos últimos $dias dias' : 'Faturado recentemente',
            style: const TextStyle(color: Color(0xFFB7C7CF), fontSize: 11),
          ),
          const SizedBox(height: 8),
          Text(
            valor != null ? formatarMoeda(valor) : '—',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.bold,
              letterSpacing: -0.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _CardMetrica extends StatelessWidget {
  const _CardMetrica({
    required this.rotulo,
    required this.valor,
    required this.tom,
    required this.status,
  });

  final String rotulo;
  final String valor;
  final Tom tom;
  final String status;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(rotulo, style: const TextStyle(color: AppColors.muted, fontSize: 11)),
          const SizedBox(height: 8),
          Text(
            valor,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, letterSpacing: -0.5),
          ),
          const SizedBox(height: 8),
          StatusBadge(texto: status, tom: tom),
        ],
      ),
    );
  }
}

class _ItemPedido extends StatelessWidget {
  const _ItemPedido({required this.pedido});

  final dynamic pedido;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: () => Navigator.of(
        context,
      ).push(MaterialPageRoute(builder: (_) => PedidoDetalheScreen(id: pedido.id))),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: Border.all(color: AppColors.line),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '#${pedido.numero ?? "—"}',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${pedido.tituloCliente} · ${formatarData(pedido.dataHoraUltimaAlteracao)}',
                    style: const TextStyle(fontSize: 11, color: AppColors.muted),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            Text(
              formatarMoeda(pedido.valorTotal),
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }
}
